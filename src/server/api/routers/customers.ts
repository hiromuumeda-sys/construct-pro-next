import { TRPCError } from "@trpc/server";
import { eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { diffChanges, logAudit } from "~/server/audit/log";
import { db } from "~/server/db";
import { customers } from "~/server/db/schema";

const customerUpsertShape = {
  company: z.string().min(1),
  department: z.string().nullish(),
  contact: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  notes: z.string().nullish(),
  capital: z.number().nullish(),
  companyScale: z.string().nullish(),
  website: z.string().nullish(),
};

export const customersRouter = createTRPCRouter({
  list: protectedProcedure.query(async () =>
    db.query.customers.findMany({
      where: isNull(customers.deletedAt),
      orderBy: (t, { desc }) => [desc(t.id)],
    })
  ),

  create: protectedProcedure
    .input(z.object(customerUpsertShape))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .insert(customers)
        .values({
          company: input.company,
          department: input.department,
          contact: input.contact,
          email: input.email,
          phone: input.phone,
          address: input.address,
          notes: input.notes,
          capital: input.capital ?? null,
          companyScale: input.companyScale || null,
          website: input.website || null,
        })
        .returning({ id: customers.id });
      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      await logAudit(ctx.user.id, "CREATE", "customers", row.id, {
        name: input.company,
        changes: [`新規登録（顧客: ${input.company || "-"}）`],
      });
      return { id: row.id, ...input };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), ...customerUpsertShape }))
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.customers.findFirst({
        where: eq(customers.id, input.id),
      });
      await db
        .update(customers)
        .set({
          company: input.company,
          department: input.department,
          contact: input.contact,
          email: input.email,
          phone: input.phone,
          address: input.address,
          notes: input.notes,
          capital: input.capital ?? null,
          companyScale: input.companyScale || null,
          website: input.website || null,
        })
        .where(eq(customers.id, input.id));
      await logAudit(ctx.user.id, "UPDATE", "customers", input.id, {
        name: before?.company || input.company,
        changes: diffChanges("customers", before, input),
      });
      return input;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const before = await db.query.customers.findFirst({
        where: eq(customers.id, input.id),
      });
      await db
        .update(customers)
        .set({ deletedAt: new Date() })
        .where(eq(customers.id, input.id));
      await logAudit(ctx.user.id, "DELETE", "customers", input.id, {
        name: before?.company,
        changes: [`削除（顧客: ${before?.company || "-"}）`],
      });
      return { success: true };
    }),
});
