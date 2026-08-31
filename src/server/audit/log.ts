import { db } from "~/server/db";
import { auditLogs } from "~/server/db/schema";

interface AuditDetails {
  changes?: string[];
  name?: string;
}

/**
 * Fail-safe: a logging failure must never abort the caller's main operation
 * (e.g. a PDF already sent by email shouldn't roll back because the audit
 * insert failed). Mirrors the old app's `logAudit` fire-and-forget behavior.
 */
export async function logAudit(
  userId: number | null,
  action: "CREATE" | "UPDATE" | "DELETE",
  tableName: string,
  recordId: number,
  details: AuditDetails = {}
): Promise<void> {
  if (!userId) {
    return;
  }
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      tableName,
      recordId,
      details,
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
