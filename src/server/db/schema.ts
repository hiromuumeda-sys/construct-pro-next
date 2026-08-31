// Drizzle schema mirroring the live construct-pro Supabase schema (same instance, no migration).
// Authored against a live `information_schema` introspection (2026-09) rather than only
// `supabase/schema.sql`, since the Express app's `ensureAux()` applies additional
// `ALTER TABLE ADD COLUMN IF NOT EXISTS` at every cold start and is the real source of truth.
// bigint/numeric money columns use `{ mode: "number" }` to replicate db.js's global
// `pg.types.setTypeParser` behavior (OID 20/1700 -> JS number) on a per-column basis.

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    role: text("role").default("user"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
    status: text("status").default("active"), // active | suspended | deleted (soft-delete)
    tokenVersion: integer("token_version").default(1), // forced-logout: bumped on role/status/password change
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)]
);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: text("action"), // CREATE | UPDATE | DELETE
  tableName: text("table_name"),
  recordId: integer("record_id"),
  details: jsonb("details"), // { name, changes: string[] }
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const invitations = pgTable(
  "invitations",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    role: text("role").notNull().default("staff"), // admin | accounting | staff
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    acceptedAt: timestamp("accepted_at", { mode: "date" }),
    createdBy: integer("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [uniqueIndex("invitations_token_key").on(t.token)]
);

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  company: text("company").notNull(),
  department: text("department"),
  contact: text("contact"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  capital: bigint("capital", { mode: "number" }),
  companyScale: text("company_scale"), // 表示名: 企業規模（従業員数）
  website: text("website"),
  deletedAt: timestamp("deleted_at", { mode: "date" }), // soft-delete
});

// vendors.id is a text PK ("001", "002", ...) assigned by MAX(id::int)+1 padStart(3,'0')
// in the current app — not a serial column. Preserve as-is; do not "fix" to serial.
export const vendors = pgTable("vendors", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  dept: text("dept"),
  contact: text("contact"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  categories: text("categories").default(""), // CSV of category names (tag list, not a FK)
  bankName: text("bank_name"),
  bankBranch: text("bank_branch"),
  bankType: text("bank_type"), // 普通 | 当座
  bankNumber: text("bank_number"), // masked to last-4 in list views; full only via detail fetch
  bankHolder: text("bank_holder"),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
  capital: bigint("capital", { mode: "number" }),
  companyScale: text("company_scale"),
  website: text("website"),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  order: integer("order"),
  note: text("note"),
});

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    client: text("client").notNull(),
    clientCompany: text("clientCompany"),
    clientPhone: text("clientPhone"),
    clientEmail: text("clientEmail"),
    clientAddress: text("clientAddress"),
    amount: bigint("amount", { mode: "number" }),
    startDate: text("startDate"), // stored as free-text date string, matching current app
    endDate: text("endDate"),
    status: text("status"), // 未対応 | 提案中 | 見積確認中 | 受注 | 失注 | オーダー移行
    notes: text("notes"),
    projectNo: text("project_no"), // WW-YYYYMM-NNN, unique-when-set (partial unique index)
    receiptStatus: text("receipt_status"), // manual override of the auto-computed 入金ステータス
    deliveryMonth: text("delivery_month"),
    processInfo: text("process_info"),
    deliveryMonthChangedAt: timestamp("delivery_month_changed_at", {
      mode: "date",
    }),
    supersededBy: integer("superseded_by"), // set automatically on 引渡月変更複製; never user-selectable
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    version: integer("version").default(1), // optimistic lock
    receiptNotes: text("receipt_notes"), // inline-editable 備考 on 売上・入金管理
  },
  (t) => [
    uniqueIndex("idx_projects_project_no_unique")
      .on(t.projectNo)
      .where(sql`${t.projectNo} is not null and ${t.projectNo} != ''`),
    check(
      "projects_amount_nonneg",
      sql`${t.amount} is null or ${t.amount} >= 0`
    ),
  ]
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    category: text("category"),
    vendor: text("vendor"), // denormalized company name copy, not a FK (mastar-protection design)
    estimate: bigint("estimate", { mode: "number" }),
    planned: bigint("planned", { mode: "number" }),
    decided: bigint("decided", { mode: "number" }),
    status: text("status"),
    details: text("details"),
    site: text("site"),
    periodStart: text("period_start"),
    periodEnd: text("period_end"),
    handover: text("handover"),
    payment: text("payment").default("月末締翌月末払い"),
    paymentStatus: text("paymentStatus").default("未払い"),
    paymentDate: text("paymentDate"),
    paymentNotes: text("paymentNotes"), // inline-editable 備考 on 支払管理
    ackDone: boolean("ack_done"),
    invoiceDone: boolean("invoice_done"),
    remaining: bigint("remaining", { mode: "number" }),
    orderNo: text("order_no"), // assigned once, at first ORDERED_STATUSES transition
    assignee: text("assignee"),
    version: integer("version").default(1), // optimistic lock
  },
  (t) => [
    check(
      "orders_estimate_nonneg",
      sql`${t.estimate} is null or ${t.estimate} >= 0`
    ),
    check(
      "orders_planned_nonneg",
      sql`${t.planned} is null or ${t.planned} >= 0`
    ),
    check(
      "orders_decided_nonneg",
      sql`${t.decided} is null or ${t.decided} >= 0`
    ),
    check(
      "orders_remaining_nonneg",
      sql`${t.remaining} is null or ${t.remaining} >= 0`
    ),
  ]
);

export const paymentRecords = pgTable(
  "payment_records",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id"),
    paidDate: text("paid_date"),
    amount: bigint("amount", { mode: "number" }),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [
    check(
      "payment_records_amount_nonneg",
      sql`${t.amount} is null or ${t.amount} >= 0`
    ),
  ]
);

export const receipts = pgTable(
  "receipts",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id"),
    receivedDate: text("received_date"),
    amount: bigint("amount", { mode: "number" }),
    month: text("month"),
    memo: text("memo"),
  },
  (t) => [
    check(
      "receipts_amount_nonneg",
      sql`${t.amount} is null or ${t.amount} >= 0`
    ),
  ]
);

export const invoices = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id"),
    invoiceNo: text("invoice_no"),
    registrationNo: text("registration_no"),
    invoiceDate: text("invoice_date"),
    dueDate: text("due_date"),
    subtotal: bigint("subtotal", { mode: "number" }),
    tax: bigint("tax", { mode: "number" }),
    total: bigint("total", { mode: "number" }),
    bankInfo: text("bank_info"),
    status: text("status").default("発行済"), // 発行済 | 発送済み
  },
  (t) => [
    check(
      "invoices_subtotal_nonneg",
      sql`${t.subtotal} is null or ${t.subtotal} >= 0`
    ),
    check("invoices_tax_nonneg", sql`${t.tax} is null or ${t.tax} >= 0`),
    check("invoices_total_nonneg", sql`${t.total} is null or ${t.total} >= 0`),
  ]
);

export const miscPayments = pgTable(
  "misc_payments",
  {
    id: serial("id").primaryKey(),
    category: text("category"),
    type: text("type").default("支払"),
    payee: text("payee"),
    amount: bigint("amount", { mode: "number" }),
    paymentDate: text("payment_date"),
    status: text("status").default("未払い"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [
    check(
      "misc_payments_amount_nonneg",
      sql`${t.amount} is null or ${t.amount} >= 0`
    ),
  ]
);

export const miscReceipts = pgTable(
  "misc_receipts",
  {
    id: serial("id").primaryKey(),
    category: text("category"),
    type: text("type").default("入金"),
    payer: text("payer"),
    amount: bigint("amount", { mode: "number" }),
    receiptDate: text("receipt_date"),
    status: text("status").default("未入金"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (t) => [
    check(
      "misc_receipts_amount_nonneg",
      sql`${t.amount} is null or ${t.amount} >= 0`
    ),
  ]
);

// Files stored as base64 data URLs directly in Postgres (not object storage) — an explicitly
// unresolved decision in the migration plan (see plan doc "未解決のまま進める判断").
// Composite PK (parent id, kind): one row per document kind per parent.
export const projectFiles = pgTable(
  "project_files",
  {
    projectId: integer("project_id").notNull(),
    kind: text("kind").notNull(), // "contract" (契約書) | others as introduced
    filename: text("filename"),
    dataUrl: text("data_url"),
    uploadedAt: timestamp("uploaded_at", { mode: "date" }).defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.kind] })]
);

export const orderFiles = pgTable(
  "order_files",
  {
    orderId: integer("order_id").notNull(),
    kind: text("kind").notNull(), // "ack" (請書) | "invoice" (請求書)
    filename: text("filename"),
    dataUrl: text("data_url"),
    uploadedAt: timestamp("uploaded_at", { mode: "date" }).defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.kind] })]
);
