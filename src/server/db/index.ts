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
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn =
  globalForDb.conn ?? postgres(env.DATABASE_URL, { prepare: false, max: 3 });

if (env.NODE_ENV !== "production") {
  globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema });
