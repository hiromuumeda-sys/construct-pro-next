import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env";
import {
  auditLogs,
  categories,
  customers,
  invitations,
  invoices,
  miscPayments,
  miscReceipts,
  orderFiles,
  orders,
  paymentRecords,
  projectFiles,
  projects,
  receipts,
  users,
  vendors,
} from "./schema";

const schema = {
  users,
  auditLogs,
  invitations,
  customers,
  vendors,
  categories,
  projects,
  orders,
  paymentRecords,
  receipts,
  invoices,
  miscPayments,
  miscReceipts,
  projectFiles,
  orderFiles,
};

/**
 * Module-scoped singleton so the connection is reused across warm serverless
 * invocations, mirroring db.js's single `Pool` in the old Express app — but
 * sized much smaller (`max: 10` was fine for one long-lived process; on
 * Vercel, many concurrent short-lived invocations each holding connections
 * can exhaust the Supabase pooler's budget).
 *
 * `prepare: false` is required, not optional: DATABASE_URL targets Supabase's
 * connection pooler in *transaction mode* (port 6543), which does not support
 * server-side prepared statements across pooled connections.
 *
 * `statement_timeout`/`idle_timeout`/`connect_timeout` guard against a
 * pooled connection getting stuck (observed in local dev: a query whose
 * result Postgres had already sent, but the client-side socket never
 * consumed — the connection then sits busy indefinitely, permanently
 * occupying one of only `max` pool slots). Without a server-side timeout,
 * enough stuck connections silently exhaust the whole pool and every new
 * query queues forever behind them with no visible error. `statement_timeout`
 * makes Postgres itself cancel a runaway query and return an error instead,
 * which is catchable and frees the slot.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const STATEMENT_TIMEOUT_MS = 15_000;
const IDLE_TIMEOUT_SECONDS = 20;
const CONNECT_TIMEOUT_SECONDS = 10;
// A single long-lived `next dev` process serves every request itself (no
// serverless fan-out to worry about), and dashboard-heavy pages issue several
// sequential queries per request — 3 connections serialize those and make
// local dev feel stuck. Production keeps the small pool serverless needs.
const MAX_CONNECTIONS = env.NODE_ENV === "production" ? 3 : 10;

const conn =
  globalForDb.conn ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    max: MAX_CONNECTIONS,
    idle_timeout: IDLE_TIMEOUT_SECONDS,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    connection: { statement_timeout: STATEMENT_TIMEOUT_MS },
  });

if (env.NODE_ENV !== "production") {
  globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema });
