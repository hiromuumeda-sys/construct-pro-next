/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "~/server/auth/jwt";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

function readCookie(headers: Headers, name: string): string | null {
  const raw = headers.get("cookie");
  if (!raw) {
    return null;
  }
  for (const part of raw.split(";")) {
    const eq_ = part.indexOf("=");
    if (eq_ === -1) {
      continue;
    }
    const key = part.slice(0, eq_).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eq_ + 1).trim());
    }
  }
  return null;
}

export interface AuthedUser {
  email: string;
  id: number;
  role: string;
}

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 *
 * Resolves the logged-in user (if any) from the httpOnly auth cookie, mirroring
 * the old app's `authMiddleware`: verifies the JWT, then re-checks `status`/
 * `token_version` against the live DB on every request (role is deliberately
 * NOT trusted from the JWT — see `requireRole` callers below — so that a role
 * change or forced logout via `token_version` takes effect immediately).
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const token = readCookie(opts.headers, AUTH_COOKIE_NAME);
  const payload = token ? verifyAuthToken(token) : null;

  let user: AuthedUser | null = null;
  if (payload) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, payload.id),
    });
    const isRevoked =
      !dbUser ||
      dbUser.status === "suspended" ||
      dbUser.status === "deleted" ||
      (payload.tv ?? 1) !== (dbUser.tokenVersion ?? 1);
    if (dbUser && !isRevoked) {
      user = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role ?? "user",
      };
    }
  }

  return { ...opts, user };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const DEV_DELAY_MAX_MS = 400;
const DEV_DELAY_MIN_MS = 100;

const timingMiddleware = t.middleware(async ({ next }) => {
  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs =
      Math.floor(Math.random() * DEV_DELAY_MAX_MS) + DEV_DELAY_MIN_MS;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure — equivalent to the old app's `authMiddleware`.
 * Throws UNAUTHORIZED if `ctx.user` wasn't resolved (missing/invalid/expired cookie,
 * revoked token_version, or suspended/deleted account — see `createTRPCContext`).
 */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(isAuthed);

/**
 * Role-gated procedure — equivalent to the old app's `requireRole([...])`.
 * Role is re-checked from `ctx.user` (itself freshly loaded from the DB per
 * request in `createTRPCContext`, not trusted from the JWT), matching the old
 * app's "role changes take effect immediately" design.
 */
function requireRole(allowedRoles: string[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "このページを閲覧する権限がありません",
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const adminProcedure = t.procedure
  .use(timingMiddleware)
  .use(isAuthed)
  .use(requireRole(["admin"]));

export const accountingOrAdminProcedure = t.procedure
  .use(timingMiddleware)
  .use(isAuthed)
  .use(requireRole(["admin", "accounting"]));
