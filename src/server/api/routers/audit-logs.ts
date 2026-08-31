import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  accountingOrAdminProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { auditLogs, users } from "~/server/db/schema";

const LIST_LIMIT = 100;
const FILTERED_LIST_LIMIT = 50;

export const auditLogsRouter = createTRPCRouter({
  // 監査ログ一覧。table_name未指定なら全件（直近100件）、指定時はそのテーブルに絞って直近50件。
  // 旧app: GET /api/audit-logs, GET /api/audit-logs/:tableName （いずれも admin/accounting限定）
  list: accountingOrAdminProcedure
    .input(z.object({ tableName: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const tableName = input?.tableName;
      const query = db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          action: auditLogs.action,
          tableName: auditLogs.tableName,
          recordId: auditLogs.recordId,
          details: auditLogs.details,
          createdAt: auditLogs.createdAt,
          email: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .orderBy(desc(auditLogs.createdAt));

      if (tableName) {
        return await query
          .where(eq(auditLogs.tableName, tableName))
          .limit(FILTERED_LIST_LIMIT);
      }

      return await query.limit(LIST_LIMIT);
    }),
});
