import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { diffChanges, logAudit } from "~/server/audit/log";
import { db } from "~/server/db";
import {
  invoices,
  orders,
  projectFiles,
  projects,
  receipts,
} from "~/server/db/schema";
import { nextProjectNoTx } from "~/server/projects/project-no";

const nonNegAmount = z.number().nonnegative().nullish();

const projectUpsertShape = {
  name: z.string().min(1),
  client: z.string().min(1),
  clientCompany: z.string().nullish(),
  clientPhone: z.string().nullish(),
  clientEmail: z.string().nullish(),
  clientAddress: z.string().nullish(),
  amount: nonNegAmount,
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  status: z.string().nullish(),
  notes: z.string().nullish(),
};

const ORDERED_STATUS = "オーダー移行";

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

export const projectsRouter = createTRPCRouter({
  list: protectedProcedure.query(async () => {
    const [rows, files] = await Promise.all([
      db.query.projects.findMany({
        where: isNull(projects.deletedAt),
        orderBy: (t, { asc }) => [asc(t.id)],
      }),
      db
        .select({
          projectId: projectFiles.projectId,
          kind: projectFiles.kind,
          filename: projectFiles.filename,
        })
        .from(projectFiles),
    ]);
    const fmap = new Map(
      files.map((f) => [`${f.projectId}:${f.kind}`, f.filename])
    );
    return rows.map((p) => ({
      ...p,
      contractHasFile: fmap.has(`${p.id}:contract`),
      contractFilename: fmap.get(`${p.id}:contract`) ?? null,
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        ...projectUpsertShape,
        deliveryMonth: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, projectNo } = await db.transaction(async (tx) => {
        const projectNoValue = await nextProjectNoTx(tx, input.deliveryMonth);
        const [row] = await tx
          .insert(projects)
          .values({
            name: input.name,
            client: input.client,
            clientCompany: input.clientCompany,
            clientPhone: input.clientPhone,
            clientEmail: input.clientEmail,
            clientAddress: input.clientAddress,
            amount: input.amount ?? null,
            startDate: input.startDate,
            endDate: input.endDate,
            status: input.status,
            notes: input.notes,
            deliveryMonth: input.deliveryMonth,
            projectNo: projectNoValue,
          })
          .returning({ id: projects.id });
        if (!row) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        return { id: row.id, projectNo: projectNoValue };
      });
      await logAudit(ctx.user.id, "CREATE", "projects", id, {
        name: input.name,
        changes: [
          `新規登録（顧客: ${input.client || "-"} / ステータス: ${input.status || "-"}）`,
        ],
      });
      return { id, projectNo };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        version: z.number().nullish(),
        name: z.string().min(1).optional(),
        client: z.string().min(1).optional(),
        clientCompany: z.string().nullish(),
        clientPhone: z.string().nullish(),
        clientEmail: z.string().nullish(),
        clientAddress: z.string().nullish(),
        amount: nonNegAmount,
        startDate: z.string().nullish(),
        endDate: z.string().nullish(),
        status: z.string().nullish(),
        notes: z.string().nullish(),
        deliveryMonth: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });
      if (!before) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "案件が見つかりません",
        });
      }
      if (before.status === ORDERED_STATUS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "この案件は新しい案件IDに移行済みのため編集できません",
        });
      }
      if (
        input.deliveryMonth !== undefined &&
        input.deliveryMonth !== before.deliveryMonth
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "引渡月の変更は複製処理（change-delivery-month）経由で行ってください",
        });
      }

      const hasVersion = input.version !== undefined && input.version !== null;
      const whereClause = hasVersion
        ? and(
            eq(projects.id, input.id),
            eq(projects.version, input.version as number)
          )
        : eq(projects.id, input.id);

      const result = await db
        .update(projects)
        .set({
          name: input.name ?? before.name,
          client: input.client ?? before.client,
          clientCompany: input.clientCompany ?? before.clientCompany,
          clientPhone: input.clientPhone ?? before.clientPhone,
          clientEmail: input.clientEmail ?? before.clientEmail,
          clientAddress: input.clientAddress ?? before.clientAddress,
          amount: keepOrClear(input.amount, before.amount),
          startDate: input.startDate ?? before.startDate,
          endDate: input.endDate ?? before.endDate,
          status: input.status ?? before.status,
          notes: input.notes ?? before.notes,
          version: sql`${projects.version} + 1`,
        })
        .where(whereClause)
        .returning({ id: projects.id, version: projects.version });

      if (result.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "他の人がこの案件を更新しました。再読み込みしてください",
        });
      }

      await logAudit(ctx.user.id, "UPDATE", "projects", input.id, {
        name: before.name ?? input.name,
        changes: diffChanges("projects", before, input),
      });
      return result[0];
    }),

  changeDeliveryMonth: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        deliveryMonth: z.string().min(1),
        name: z.string().nullish(),
        client: z.string().nullish(),
        clientCompany: z.string().nullish(),
        amount: nonNegAmount,
        startDate: z.string().nullish(),
        endDate: z.string().nullish(),
        status: z.string().nullish(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });
      if (!before) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "案件が見つかりません",
        });
      }
      if (before.status === ORDERED_STATUS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "この案件は既に新しい案件IDへ移行済みです",
        });
      }

      const { id: newProjectId, projectNo } = await db.transaction(
        async (tx) => {
          const projectNoValue = await nextProjectNoTx(tx, input.deliveryMonth);
          const [row] = await tx
            .insert(projects)
            .values({
              name: input.name ?? before.name,
              client: input.client ?? before.client,
              clientCompany: input.clientCompany ?? before.clientCompany,
              clientPhone: before.clientPhone,
              clientEmail: before.clientEmail,
              clientAddress: before.clientAddress,
              amount: keepOrClear(input.amount, before.amount),
              startDate: input.startDate ?? before.startDate,
              endDate: input.endDate ?? before.endDate,
              status: input.status ?? before.status,
              notes: input.notes ?? before.notes,
              deliveryMonth: input.deliveryMonth,
              projectNo: projectNoValue,
            })
            .returning({ id: projects.id });
          if (!row) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          }

          await tx
            .update(projects)
            .set({ status: ORDERED_STATUS, supersededBy: row.id })
            .where(eq(projects.id, input.id));
          await tx
            .update(orders)
            .set({ projectId: row.id })
            .where(eq(orders.projectId, input.id));
          await tx
            .update(receipts)
            .set({ projectId: row.id })
            .where(eq(receipts.projectId, input.id));
          await tx
            .update(invoices)
            .set({ projectId: row.id })
            .where(eq(invoices.projectId, input.id));
          await tx
            .update(projectFiles)
            .set({ projectId: row.id })
            .where(eq(projectFiles.projectId, input.id));

          return { id: row.id, projectNo: projectNoValue };
        }
      );

      await logAudit(ctx.user.id, "CREATE", "projects", newProjectId, {
        name: input.name ?? before.name,
        changes: [
          `引渡月変更に伴う複製（複製元案件ID: ${before.projectNo || `#${input.id}`}）`,
        ],
      });
      await logAudit(ctx.user.id, "UPDATE", "projects", input.id, {
        name: before.name,
        changes: [
          `引渡月変更のため新しい案件ID「${projectNo}」に移行し、オーダー移行ステータスに変更（編集不可）`,
        ],
      });

      return { oldId: input.id, newId: newProjectId, projectNo };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });
      if (!before) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await db
        .update(projects)
        .set({ deletedAt: new Date() })
        .where(eq(projects.id, input.id));
      await logAudit(ctx.user.id, "DELETE", "projects", input.id, {
        name: before.name,
        changes: [`削除（案件: ${before.name || "-"}）`],
      });
      return { success: true };
    }),

  updateReceiptStatus: protectedProcedure
    .input(z.object({ id: z.number(), value: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });
      if (!before) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const prev = before.receiptStatus || "(自動)";
      await db
        .update(projects)
        .set({ receiptStatus: input.value })
        .where(eq(projects.id, input.id));
      await logAudit(ctx.user.id, "UPDATE", "projects", input.id, {
        name: before.name,
        changes: [`入金ステータスを ${prev} → ${input.value} に変更`],
      });
      return { success: true };
    }),

  updateReceiptNotes: protectedProcedure
    .input(z.object({ id: z.number(), value: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });
      if (!before) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await db
        .update(projects)
        .set({ receiptNotes: input.value })
        .where(eq(projects.id, input.id));
      await logAudit(ctx.user.id, "UPDATE", "projects", input.id, {
        name: before.name,
        changes: [
          `備考を ${before.receiptNotes || "(空)"} → ${input.value || "(空)"} に変更`,
        ],
      });
      return { success: true };
    }),

  uploadContractFile: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        filename: z.string().nullish(),
        dataUrl: z.string().startsWith("data:application/pdf"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const filename = input.filename || "contract.pdf";
      await db
        .insert(projectFiles)
        .values({
          projectId: input.id,
          kind: "contract",
          filename,
          dataUrl: input.dataUrl,
        })
        .onConflictDoUpdate({
          target: [projectFiles.projectId, projectFiles.kind],
          set: { filename, dataUrl: input.dataUrl, uploadedAt: new Date() },
        });
      await logAudit(ctx.user.id, "UPDATE", "projects", input.id, {
        name: project.name,
        changes: [`契約書PDFをアップロード（${filename}）`],
      });
      return { success: true };
    }),

  deleteContractFile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });
      await db
        .delete(projectFiles)
        .where(
          and(
            eq(projectFiles.projectId, input.id),
            eq(projectFiles.kind, "contract")
          )
        );
      await logAudit(ctx.user.id, "UPDATE", "projects", input.id, {
        name: project ? project.name : `#${input.id}`,
        changes: ["契約書PDFを削除"],
      });
      return { success: true };
    }),
});
