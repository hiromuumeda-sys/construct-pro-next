import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  accountingOrAdminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { diffChanges, logAudit } from "~/server/audit/log";
import { db } from "~/server/db";
import { orderFiles, orders } from "~/server/db/schema";
import { ensureOrderNo, workId } from "~/server/orders/order-no";

const nonNegAmount = z.number().nonnegative().nullish();

// 注文（発注）が確定した状態。この状態になって初めて工事IDを採番する
const ORDERED_STATUSES = new Set(["発注完了", "支払済み"]);

const orderUpdateInput = z.object({
  id: z.number(),
  version: z.number().nullish(),
  projectId: z.number().optional(),
  category: z.string().nullish(),
  vendor: z.string().nullish(),
  estimate: nonNegAmount,
  planned: nonNegAmount,
  decided: nonNegAmount,
  status: z.string().nullish(),
  details: z.string().nullish(),
  site: z.string().nullish(),
  periodStart: z.string().nullish(),
  periodEnd: z.string().nullish(),
  handover: z.string().nullish(),
  payment: z.string().nullish(),
  paymentStatus: z.string().nullish(),
  paymentDate: z.string().nullish(),
  paymentNotes: z.string().nullish(),
  assignee: z.string().nullish(),
});

type OrderUpdateInput = z.infer<typeof orderUpdateInput>;
type OrderRow = typeof orders.$inferSelect;

/**
 * undefined（未送信）なら既存値を維持、null（明示的にクリア）ならクリアする。
 * `??` だと undefined/null を区別できず、金額欄を空にして保存してもクリアされない
 * バグになるため、null許容フィールドはこのヘルパーで区別する。
 */
function keepOrClear<T>(
  value: T | null | undefined,
  before: T | null
): T | null {
  return value === undefined ? before : value;
}

/** 未送信の項目は既存値を維持する（部分更新のマージ）。status/orderNo/versionは呼び出し元で別途設定する。 */
function mergeOrderFields(input: OrderUpdateInput, before: OrderRow) {
  return {
    projectId: input.projectId ?? before.projectId,
    category: input.category ?? before.category,
    vendor: input.vendor ?? before.vendor,
    estimate: keepOrClear(input.estimate, before.estimate),
    planned: keepOrClear(input.planned, before.planned),
    decided: keepOrClear(input.decided, before.decided),
    details: input.details ?? before.details,
    site: input.site ?? before.site,
    periodStart: input.periodStart ?? before.periodStart,
    periodEnd: input.periodEnd ?? before.periodEnd,
    handover: input.handover ?? before.handover,
    payment: input.payment ?? before.payment,
    paymentStatus: input.paymentStatus ?? before.paymentStatus,
    paymentDate: input.paymentDate ?? before.paymentDate,
    paymentNotes: input.paymentNotes ?? before.paymentNotes,
    assignee: input.assignee ?? before.assignee,
  };
}

export const ordersRouter = createTRPCRouter({
  list: protectedProcedure.query(async () => {
    const [rows, files] = await Promise.all([
      db.query.orders.findMany({ orderBy: (t, { asc }) => [asc(t.id)] }),
      db
        .select({
          orderId: orderFiles.orderId,
          kind: orderFiles.kind,
          filename: orderFiles.filename,
        })
        .from(orderFiles),
    ]);
    const fmap = new Map(
      files.map((f) => [`${f.orderId}:${f.kind}`, f.filename])
    );
    return rows.map((o) => ({
      ...o,
      ackHasFile: fmap.has(`${o.id}:ack`),
      ackFilename: fmap.get(`${o.id}:ack`) ?? null,
      invoiceHasFile: fmap.has(`${o.id}:invoice`),
      invoiceFilename: fmap.get(`${o.id}:invoice`) ?? null,
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        category: z.string().nullish(),
        vendor: z.string().nullish(),
        estimate: nonNegAmount,
        planned: nonNegAmount,
        decided: nonNegAmount,
        status: z.string().nullish(),
        details: z.string().nullish(),
        site: z.string().nullish(),
        periodStart: z.string().nullish(),
        periodEnd: z.string().nullish(),
        handover: z.string().nullish(),
        payment: z.string().nullish(),
        paymentStatus: z.string().nullish(),
        paymentDate: z.string().nullish(),
        paymentNotes: z.string().nullish(),
        assignee: z.string().nullish(),
        remaining: nonNegAmount,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id: insId, orderNo } = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(orders)
          .values({
            projectId: input.projectId,
            category: input.category,
            vendor: input.vendor,
            estimate: input.estimate ?? null,
            planned: input.planned ?? null,
            decided: input.decided ?? null,
            status: input.status,
            details: input.details,
            site: input.site,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            handover: input.handover,
            payment: input.payment || "月末締翌月末払い",
            paymentStatus: input.paymentStatus || "未払い",
            paymentDate: input.paymentDate || "",
            paymentNotes: input.paymentNotes || "",
            assignee: input.assignee || "",
            remaining: input.remaining ?? input.decided ?? 0,
          })
          .returning({ id: orders.id });
        if (!row) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        let orderNoValue: string | null = null;
        if (input.status && ORDERED_STATUSES.has(input.status)) {
          orderNoValue = workId(row.id);
          await tx
            .update(orders)
            .set({ orderNo: orderNoValue })
            .where(eq(orders.id, row.id));
        }
        return { id: row.id, orderNo: orderNoValue };
      });
      await logAudit(ctx.user.id, "CREATE", "orders", insId, {
        name: `${input.category || ""}（${input.vendor || ""}）`,
        changes: [
          `新規登録（工事区分: ${input.category || "-"} / 発注先: ${input.vendor || "-"}）`,
        ],
      });
      return { id: insId, orderNo };
    }),

  update: protectedProcedure
    .input(orderUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.orders.findFirst({
        where: eq(orders.id, input.id),
      });
      if (!before) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "発注明細が見つかりません",
        });
      }
      const newStatus = input.status ?? before.status;
      const orderNo =
        !before.orderNo && newStatus && ORDERED_STATUSES.has(newStatus)
          ? workId(input.id)
          : before.orderNo;

      const hasVersion = input.version !== undefined && input.version !== null;
      const whereClause = hasVersion
        ? and(
            eq(orders.id, input.id),
            eq(orders.version, input.version as number)
          )
        : eq(orders.id, input.id);

      const result = await db
        .update(orders)
        .set({
          ...mergeOrderFields(input, before),
          status: newStatus,
          orderNo,
          version: sql`${orders.version} + 1`,
        })
        .where(whereClause)
        .returning({
          id: orders.id,
          version: orders.version,
          orderNo: orders.orderNo,
        });

      if (result.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "他の人がこの発注を更新しました。再読み込みしてください",
        });
      }

      await logAudit(ctx.user.id, "UPDATE", "orders", input.id, {
        name: `${before.category || input.category || ""}（${before.vendor || input.vendor || ""}）`,
        changes: diffChanges("orders", before, input),
      });
      return result[0];
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.orders.findFirst({
        where: eq(orders.id, input.id),
      });
      if (!before) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await db.delete(orders).where(eq(orders.id, input.id));
      await logAudit(ctx.user.id, "DELETE", "orders", input.id, {
        name: `${before.category || ""}（${before.vendor || ""}）`,
        changes: [
          `削除（${before.category || "-"} / ${before.vendor || "-"}）`,
        ],
      });
      return { success: true };
    }),

  updateDocStatus: accountingOrAdminProcedure
    .input(
      z.object({
        id: z.number(),
        kind: z.enum(["ack", "invoice"]),
        value: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.orders.findFirst({
        where: eq(orders.id, input.id),
      });
      if (!before) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const label = input.kind === "invoice" ? "請求書" : "請書";
      await db
        .update(orders)
        .set(
          input.kind === "invoice"
            ? { invoiceDone: input.value }
            : { ackDone: input.value }
        )
        .where(eq(orders.id, input.id));
      await logAudit(ctx.user.id, "UPDATE", "orders", input.id, {
        name: `${before.category || ""}（${before.vendor || ""}）`,
        changes: [`${label}を ${input.value ? "未 → 済" : "済 → 未"} に変更`],
      });
      return { success: true };
    }),

  updateRemaining: protectedProcedure
    .input(z.object({ id: z.number(), value: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.orders.findFirst({
        where: eq(orders.id, input.id),
      });
      if (!before) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const value = Math.max(0, Math.trunc(input.value) || 0);
      await db
        .update(orders)
        .set({ remaining: value })
        .where(eq(orders.id, input.id));
      const prev = before.remaining ?? before.decided;
      await logAudit(ctx.user.id, "UPDATE", "orders", input.id, {
        name: `${before.category || ""}（${before.vendor || ""}）`,
        changes: [
          `残金を ${prev?.toLocaleString() ?? "(空)"} → ${value.toLocaleString()} に変更`,
        ],
      });
      return { success: true };
    }),

  ensureOrderNo: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, input.id),
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const orderNo = await ensureOrderNo(order);
      return { orderNo };
    }),

  uploadFile: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        kind: z.enum(["ack", "invoice"]),
        filename: z.string().nullish(),
        dataUrl: z.string().startsWith("data:application/pdf"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, input.id),
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const label = input.kind === "invoice" ? "請求書" : "請書";
      const fallback = input.kind === "invoice" ? "invoice.pdf" : "ukesho.pdf";
      const filename = input.filename || fallback;
      await db
        .insert(orderFiles)
        .values({
          orderId: input.id,
          kind: input.kind,
          filename,
          dataUrl: input.dataUrl,
        })
        .onConflictDoUpdate({
          target: [orderFiles.orderId, orderFiles.kind],
          set: { filename, dataUrl: input.dataUrl, uploadedAt: new Date() },
        });
      await db
        .update(orders)
        .set(
          input.kind === "invoice" ? { invoiceDone: true } : { ackDone: true }
        )
        .where(eq(orders.id, input.id));
      await logAudit(ctx.user.id, "UPDATE", "orders", input.id, {
        name: `${order.category || ""}（${order.vendor || ""}）`,
        changes: [`${label}PDFをアップロード（${filename}）／済に変更`],
      });
      return { success: true };
    }),

  deleteFile: protectedProcedure
    .input(z.object({ id: z.number(), kind: z.enum(["ack", "invoice"]) }))
    .mutation(async ({ ctx, input }) => {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, input.id),
      });
      const label = input.kind === "invoice" ? "請求書" : "請書";
      await db
        .delete(orderFiles)
        .where(
          and(eq(orderFiles.orderId, input.id), eq(orderFiles.kind, input.kind))
        );
      await db
        .update(orders)
        .set(
          input.kind === "invoice" ? { invoiceDone: false } : { ackDone: false }
        )
        .where(eq(orders.id, input.id));
      await logAudit(ctx.user.id, "UPDATE", "orders", input.id, {
        name: order
          ? `${order.category || ""}（${order.vendor || ""}）`
          : `#${input.id}`,
        changes: [`${label}PDFを削除／未に変更`],
      });
      return { success: true };
    }),
});
