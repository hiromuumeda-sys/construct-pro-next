import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { logAudit } from "~/server/audit/log";
import { db } from "~/server/db";
import { invoices, orders, projects } from "~/server/db/schema";

// server.js POST /api/invoices の固定値をそのまま踏襲（請求書ごとに変わらない自社情報）
const REGISTRATION_NO = "T8130001068355";
const BANK_INFO = "〇〇銀行 京都支店 (普)0777777";
const DEFAULT_STATUS = "発行済";
const TAX_RATE = 0.1;
const DUE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const INVOICE_NO_SEQ_DIGITS = 3;

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const invoicesRouter = createTRPCRouter({
  // server.js: GET /api/invoices（ORDER BY id DESC + 任意の pagingClause）
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().optional(),
          offset: z.number().int().nonnegative().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const base = db.select().from(invoices).orderBy(desc(invoices.id));
      if (input?.limit && input.limit > 0) {
        return await base.limit(input.limit).offset(input.offset ?? 0);
      }
      return await base;
    }),

  // server.js: POST /api/invoices — subtotal/tax/total は常にサーバー側で
  // orders.decided の合計から算出され、クライアントからは受け取らない
  // （rejectNegativeAmount は実際にはこのルートで呼ばれておらず、金額はDBの
  // CHECK制約 invoices_*_nonneg と、算出元である orders.decided 側の
  // orders_decided_nonneg CHECK制約により非負が保証されている）。
  create: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "プロジェクトが見つかりません",
        });
      }

      const created = await db.transaction(async (tx) => {
        // COUNT→採番の間に他リクエストが割り込めないよう排他
        // （nextProjectNoTx と同じ pg_advisory_xact_lock 方式）
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('invoices_invoice_no'))`
        );

        const projectOrders = await tx.query.orders.findMany({
          where: eq(orders.projectId, input.projectId),
        });
        const subtotal = projectOrders.reduce(
          (s, o) => s + (Number(o.decided) || 0),
          0
        );
        const tax = Math.floor(subtotal * TAX_RATE);
        const total = subtotal + tax;

        const countRows = await tx
          .select({ cnt: sql<number>`count(*)::int` })
          .from(invoices);
        const invoiceNo = `WW-${String((countRows[0]?.cnt ?? 0) + 1).padStart(INVOICE_NO_SEQ_DIGITS, "0")}`;

        const now = new Date();
        const invoiceDate = toDateOnly(now);
        const dueDate = toDateOnly(
          new Date(now.getTime() + DUE_DAYS * MS_PER_DAY)
        );

        const [row] = await tx
          .insert(invoices)
          .values({
            projectId: input.projectId,
            invoiceNo,
            registrationNo: REGISTRATION_NO,
            invoiceDate,
            dueDate,
            subtotal,
            tax,
            total,
            bankInfo: BANK_INFO,
            status: DEFAULT_STATUS,
          })
          .returning({ id: invoices.id });
        if (!row) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        return {
          id: row.id,
          invoiceNo,
          subtotal,
          tax,
          total,
          invoiceDate,
          dueDate,
        };
      });

      await logAudit(ctx.user.id, "CREATE", "invoices", created.id, {
        name: created.invoiceNo,
        changes: [
          `請求書を発行（案件ID: ${input.projectId} / 合計: ${created.total.toLocaleString()}円）`,
        ],
      });

      return { ...created, projectId: input.projectId };
    }),

  // server.js: DELETE /api/invoices/:id — 存在チェックなし、監査ログも空詳細のまま記録
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(invoices).where(eq(invoices.id, input.id));
      await logAudit(ctx.user.id, "DELETE", "invoices", input.id, {});
      return { success: true };
    }),
});
