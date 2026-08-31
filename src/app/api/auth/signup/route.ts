import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  authCookieOptions,
  signAuthToken,
} from "~/server/auth/jwt";
import { db } from "~/server/db";
import { auditLogs, users } from "~/server/db/schema";

export const runtime = "nodejs";

const BCRYPT_ROUNDS = 10;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    password?: string;
    name?: string;
  } | null;
  const email = body?.email;
  const password = body?.password;
  const name = body?.name ?? "";
  if (!(email && password)) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 }
    );
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name, role: "user" })
    .returning();
  if (!user) {
    return NextResponse.json({ error: "signup failed" }, { status: 500 });
  }

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "CREATE",
    tableName: "users",
    recordId: user.id,
    details: { email, name },
  });

  const token = signAuthToken({
    id: user.id,
    email: user.email,
    tv: user.tokenVersion ?? 1,
  });

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  res.cookies.set(
    AUTH_COOKIE_NAME,
    token,
    authCookieOptions(AUTH_COOKIE_MAX_AGE_SECONDS)
  );
  return res;
}
