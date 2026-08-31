import { TRPCError } from "@trpc/server";
import { eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { diffChanges, logAudit } from "~/server/audit/log";
import { db } from "~/server/db";
import { vendors } from "~/server/db/schema";

const VENDOR_ID_DIGITS = 3;

/**
 * 一覧・全社共有キャッシュでは口座番号を下4桁のみ表示（銀行口座情報の平文・無制限閲覧対策）。
 * 編集時は getById で都度フルの値を取得する（server.js maskVendorBank 相当）。
 */
function maskVendorBank<T extends { bankNumber: string | null }>(v: T): T {
  if (!v.bankNumber) {
    return v;
  }
  return { ...v, bankNumber: `****${v.bankNumber.slice(-4)}` };
}

/**
 * undefined（未送信）なら既存値を維持、null（明示的にクリア）ならクリアする。
 * `??` だと undefined/null を区別できず、資本金を0や空にして保存してもクリア
 * されないバグになるため、null許容フィールドはこのヘルパーで区別する。
 */
function keepOrClear<T>(
  value: T | null | undefined,
  before: T | null
): T | null {
  return value === undefined ? before : value;
}

const vendorUpsertShape = {
  company: z.string().min(1),
  dept: z.string().nullish(),
  contact: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  categories: z.string().nullish(),
  bankName: z.string().nullish(),
  bankBranch: z.string().nullish(),
  bankType: z.string().nullish(),
  bankNumber: z.string().nullish(),
  bankHolder: z.string().nullish(),
  capital: z.number().nullish(),
  companyScale: z.string().nullish(),
  website: z.string().nullish(),
};

export const vendorsRouter = createTRPCRouter({
  list: protectedProcedure.query(async () => {
    const rows = await db
      .select()
      .from(vendors)
      .where(isNull(vendors.deletedAt))
      .orderBy(sql`${vendors.id}::int desc`);
    return rows.map(maskVendorBank);
  }),

  // 編集画面用：口座番号を含む全項目を返す（一覧はマスク済みのため、編集時はここから取得する）
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const row = await db.query.vendors.findFirst({
        where: eq(vendors.id, input.id),
      });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "発注先が見つかりません",
        });
      }
      return row;
    }),

  create: protectedProcedure
    .input(z.object(vendorUpsertShape))
    .mutation(async ({ ctx, input }) => {
      const [maxRow] = await db
        .select({ max: sql<number>`coalesce(max(${vendors.id}::int), 0)` })
        .from(vendors);
      const newId = String((maxRow?.max ?? 0) + 1).padStart(
        VENDOR_ID_DIGITS,
        "0"
      );

      const [inserted] = await db
        .insert(vendors)
        .values({
          id: newId,
          company: input.company,
          dept: input.dept,
          contact: input.contact,
          email: input.email,
          phone: input.phone,
          address: input.address,
          categories: input.categories || "",
          bankName: input.bankName || "",
          bankBranch: input.bankBranch || "",
          bankType: input.bankType || "",
          bankNumber: input.bankNumber || "",
          bankHolder: input.bankHolder || "",
          capital: input.capital ?? null,
          companyScale: input.companyScale || null,
          website: input.website || null,
        })
        .returning();
      if (!inserted) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      await logAudit(ctx.user.id, "CREATE", "vendors", Number(newId), {
        name: input.company,
        changes: [`新規登録（発注先: ${input.company || "-"}）`],
      });
      return inserted;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        ...vendorUpsertShape,
        company: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.vendors.findFirst({
        where: eq(vendors.id, input.id),
      });
      if (!before) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "発注先が見つかりません",
        });
      }

      const [updated] = await db
        .update(vendors)
        .set({
          company: input.company ?? before.company,
          dept: input.dept ?? before.dept,
          contact: input.contact ?? before.contact,
          email: input.email ?? before.email,
          phone: input.phone ?? before.phone,
          address: input.address ?? before.address,
          categories: input.categories ?? before.categories ?? "",
          bankName: input.bankName ?? before.bankName ?? "",
          bankBranch: input.bankBranch ?? before.bankBranch ?? "",
          bankType: input.bankType ?? before.bankType ?? "",
          bankNumber: input.bankNumber ?? before.bankNumber ?? "",
          bankHolder: input.bankHolder ?? before.bankHolder ?? "",
          capital: keepOrClear(input.capital, before.capital),
          companyScale: keepOrClear(input.companyScale, before.companyScale),
          website: keepOrClear(input.website, before.website),
        })
        .where(eq(vendors.id, input.id))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      await logAudit(ctx.user.id, "UPDATE", "vendors", Number(input.id), {
        name: before.company || input.company,
        changes: diffChanges("vendors", before, input),
      });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.vendors.findFirst({
        where: eq(vendors.id, input.id),
      });
      if (!before) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await db
        .update(vendors)
        .set({ deletedAt: new Date() })
        .where(eq(vendors.id, input.id));
      await logAudit(ctx.user.id, "DELETE", "vendors", Number(input.id), {
        name: before.company,
        changes: [`削除（発注先: ${before.company || "-"}）`],
      });
      return { success: true };
    }),
});
