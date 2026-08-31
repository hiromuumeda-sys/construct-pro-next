import { eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  type invoices,
  type orders,
  projectFiles,
  projects,
} from "~/server/db/schema";

type OrderRow = typeof orders.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type InvoiceRow = typeof invoices.$inferSelect;

// ============ 共通の日付ヘルパー（server.js のロジックをそのまま移植） ============

const YM_PREFIX_RE = /^(\d{4})-(\d{2})/;

/** "YYYY-MM..." または "YYYY/MM..." から "YYYY-MM" を取り出す。server.js の ymOfDate と同じ規則。 */
function ymOfDate(s: string | null | undefined): string | null {
  if (!s) {
    return null;
  }
  const m = String(s).replaceAll("/", "-").match(YM_PREFIX_RE);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** from/to（'YYYY-MM'）の連続した月配列を返す。server.js の monthRange と同じ規則（120件で打ち切り）。 */
function monthRange(from: string, to: string): string[] {
  const list: string[] = [];
  const [fyRaw, fmRaw] = from.split("-").map(Number);
  const [tyRaw, tmRaw] = to.split("-").map(Number);
  let fy = fyRaw ?? 0;
  let fm = fmRaw ?? 1;
  const ty = tyRaw ?? 0;
  const tm = tmRaw ?? 1;
  while (fy < ty || (fy === ty && fm <= tm)) {
    list.push(`${fy}-${String(fm).padStart(2, "0")}`);
    fm++;
    if (fm > 12) {
      fm = 1;
      fy++;
    }
    if (list.length > 120) {
      break;
    }
  }
  return list;
}

/** "/"区切りも許容してDateへ変換。不正な日付はnull。server.js の parseD と同じ規則。 */
function parseD(s: string | null | undefined): Date | null {
  if (!s) {
    return null;
  }
  const d = new Date(String(s).replaceAll("/", "-"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * server.js の daysBetween を忠実に移植。
 * `new Date(null)` は Invalid Date にはならずエポック（getTime()=0）になるため、
 * 呼び出し側が事前にfalsy値をスキップしない限り「日付なし」は「大昔に期日超過」として
 * 扱われる（＝欠落日付は自動的にnullへ丸められない）。
 * server.js内の呼び出し箇所ごとの挙動差（支払期日・契約書チェックは事前にfalsyチェックあり、
 * 請求書の入金期日チェックのみ事前チェック無し＝server.js:1627）をそのまま再現するため、
 * この関数自体では null/undefined を弾かない。
 */
function daysBetween(
  value: string | null | undefined,
  today: Date
): number | null {
  const t = value == null ? new Date(0) : new Date(value);
  if (Number.isNaN(t.getTime())) {
    return null;
  }
  return Math.ceil((t.getTime() - today.getTime()) / 86_400_000);
}

// ============ 通知一覧（/api/notifications 相当） ============

type NotificationLevel = "error" | "warning" | "info";

interface DashboardNotification {
  assignee?: string | null;
  date: string | null;
  icon: string;
  keyword: string | null;
  level: NotificationLevel;
  link: string;
  message: string;
  title: string;
  type: "payment" | "receipt" | "missing" | "contract";
}

function sumAmountByProjectId<T>(
  rows: T[],
  getProjectId: (row: T) => number | null,
  getAmount: (row: T) => number | null
): Map<number, number> {
  const sums = new Map<number, number>();
  for (const row of rows) {
    const projectId = getProjectId(row);
    if (projectId == null) {
      continue;
    }
    sums.set(
      projectId,
      (sums.get(projectId) || 0) + (Number(getAmount(row)) || 0)
    );
  }
  return sums;
}

function countByProjectId<T>(
  rows: T[],
  getProjectId: (row: T) => number | null
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows) {
    const projectId = getProjectId(row);
    if (projectId == null) {
      continue;
    }
    counts.set(projectId, (counts.get(projectId) || 0) + 1);
  }
  return counts;
}

/**
 * 支払期日アラート（未払いの注文のみ対象）。keywordは発注先名ではなく発注明細の# (id) を使う：
 * 同じ発注先には他にも多数の発注明細があるため、発注先名だと検索結果がその発注先の全件に
 * なってしまい、通知が指している1件に絞り込めない。
 */
function paymentDueNotifications(
  allOrders: OrderRow[],
  today: Date
): DashboardNotification[] {
  const notifications: DashboardNotification[] = [];
  for (const o of allOrders) {
    // SQLの `"paymentStatus" != '支払済み'` はNULL行を除外する三値論理のため、
    // JS側のフィルタでも null を明示的に除外して同じ挙動にする。
    if (o.paymentStatus == null || o.paymentStatus === "支払済み") {
      continue;
    }
    if (!o.paymentDate) {
      continue;
    }
    const d = daysBetween(o.paymentDate, today);
    if (d === null) {
      continue;
    }
    if (d < 0) {
      notifications.push({
        type: "payment",
        level: "error",
        icon: "error",
        title: "支払期日超過",
        message: `${o.vendor} への支払（${o.category}）が${Math.abs(d)}日超過しています`,
        date: o.paymentDate,
        link: "/payment",
        keyword: String(o.id),
        assignee: o.assignee || null,
      });
    } else if (d <= 7) {
      notifications.push({
        type: "payment",
        level: "warning",
        icon: "schedule",
        title: "支払期日接近",
        message: `${o.vendor} への支払（${o.category}）まであと${d}日です`,
        date: o.paymentDate,
        link: "/payment",
        keyword: String(o.id),
        assignee: o.assignee || null,
      });
    }
  }
  return notifications;
}

/**
 * 入金期日アラート（請求書の未入金残ベース）。keywordは案件名ではなく案件の# (id) を使う：
 * 引渡月変更で複製された案件は同名になるため、名前だと検索時に複数ヒットしてしまい対象を
 * 一意に絞り込めない。
 */
function receiptDueNotificationFor(
  inv: InvoiceRow,
  project: ProjectRow | undefined,
  receiptSumByProject: Map<number, number>,
  today: Date
): DashboardNotification | null {
  const received =
    (inv.projectId == null ? 0 : receiptSumByProject.get(inv.projectId)) || 0;
  const outstanding = (Number(inv.total) || 0) - received;
  if (outstanding <= 0) {
    return null;
  }
  const d = daysBetween(inv.dueDate, today);
  if (d === null) {
    return null;
  }
  const yen = `¥${outstanding.toLocaleString()}`;
  const projectLabel = project ? project.name : "案件";
  const keyword = project ? String(project.id) : null;
  if (d < 0) {
    return {
      type: "receipt",
      level: "error",
      icon: "error",
      title: "入金期日超過（未入金）",
      message: `${projectLabel}（${inv.invoiceNo}）の入金期日が${Math.abs(d)}日超過・未入金残 ${yen}`,
      date: inv.dueDate,
      link: "/receipts",
      keyword,
    };
  }
  if (d <= 7) {
    return {
      type: "receipt",
      level: "warning",
      icon: "schedule",
      title: "入金期日接近",
      message: `${projectLabel}（${inv.invoiceNo}）の入金期日まであと${d}日・未入金残 ${yen}`,
      date: inv.dueDate,
      link: "/receipts",
      keyword,
    };
  }
  return null;
}

function receiptDueNotifications(
  allInvoices: InvoiceRow[],
  projectById: Map<number, ProjectRow>,
  receiptSumByProject: Map<number, number>,
  today: Date
): DashboardNotification[] {
  const notifications: DashboardNotification[] = [];
  for (const inv of allInvoices) {
    const project =
      inv.projectId == null ? undefined : projectById.get(inv.projectId);
    const notification = receiptDueNotificationFor(
      inv,
      project,
      receiptSumByProject,
      today
    );
    if (notification) {
      notifications.push(notification);
    }
  }
  return notifications;
}

function missingInvoiceNotifications(
  wonProjects: ProjectRow[],
  invoiceCountByProject: Map<number, number>
): DashboardNotification[] {
  const notifications: DashboardNotification[] = [];
  for (const p of wonProjects) {
    if (!invoiceCountByProject.get(p.id)) {
      notifications.push({
        type: "missing",
        level: "info",
        icon: "description",
        title: "請求書未発行",
        message: `${p.name} は受注済みですが請求書が未発行です`,
        date: null,
        link: "/projects",
        keyword: String(p.id),
      });
    }
  }
  return notifications;
}

/**
 * 担当者ベースのタスク通知（担当者ごとに個別表示。議事録論点）。
 * ステータスがNULLの明細はSQLの `status NOT IN (...)` と同様に除外する（三値論理の再現）。
 */
function undeliveredOrderNotifications(
  allOrders: OrderRow[]
): DashboardNotification[] {
  const undelivered = allOrders.filter(
    (o) =>
      o.status != null &&
      o.status !== "発注完了" &&
      o.status !== "支払済み" &&
      (Number(o.decided) || 0) > 0
  );
  if (undelivered.length === 0) {
    return [];
  }
  const byAssignee = new Map<string, number>();
  for (const o of undelivered) {
    const key = o.assignee || "";
    byAssignee.set(key, (byAssignee.get(key) || 0) + 1);
  }
  const notifications: DashboardNotification[] = [];
  for (const [assignee, cnt] of byAssignee) {
    notifications.push({
      type: "missing",
      level: "info",
      icon: "receipt_long",
      title: "注文書未発行",
      message: assignee
        ? `${assignee}さん担当で決定済み・注文書未発行の明細が${cnt}件あります`
        : `担当者未設定で決定済み・注文書未発行の明細が${cnt}件あります`,
      date: null,
      link: "/orders-list",
      keyword: null,
      assignee: assignee || null,
    });
  }
  return notifications;
}

/** 契約書未締結アラート（議事録決定事項：着工日超過で未締結ならアラート） */
function contractMissingNotifications(
  contractCheckProjects: ProjectRow[],
  projectsWithContract: Set<number | null>,
  today: Date
): DashboardNotification[] {
  const notifications: DashboardNotification[] = [];
  for (const p of contractCheckProjects) {
    const d = daysBetween(p.startDate, today);
    if (d === null || d >= 0) {
      continue; // 着工日が未到来の案件は対象外
    }
    if (!projectsWithContract.has(p.id)) {
      notifications.push({
        type: "contract",
        level: "error",
        icon: "error",
        title: "契約書未締結",
        message: `${p.name} は着工日を${Math.abs(d)}日超過していますが契約書が未締結です`,
        date: p.startDate,
        link: "/projects",
        keyword: String(p.id),
      });
    }
  }
  return notifications;
}

async function buildNotifications(): Promise<DashboardNotification[]> {
  const today = new Date();

  // 案件・請求書数に比例したループ内SELECT（N+1）を避けるため、必要な集計を先に一括取得する
  const [
    allOrders,
    allInvoices,
    allProjectsForNotif,
    allReceipts,
    contractFiles,
  ] = await Promise.all([
    db.query.orders.findMany(),
    db.query.invoices.findMany(),
    db.query.projects.findMany(),
    db.query.receipts.findMany(),
    db.query.projectFiles.findMany({
      where: eq(projectFiles.kind, "contract"),
    }),
  ]);

  const projectByIdForNotif = new Map(
    allProjectsForNotif.map((p) => [p.id, p])
  );
  const receiptSumByProject = sumAmountByProjectId(
    allReceipts,
    (r) => r.projectId,
    (r) => r.amount
  );
  const invoiceCountByProject = countByProjectId(
    allInvoices,
    (inv) => inv.projectId
  );
  const wonProjects = allProjectsForNotif.filter(
    (p) => p.deletedAt === null && p.status === "受注"
  );
  const contractCheckProjects = allProjectsForNotif.filter(
    (p) => p.deletedAt === null && p.startDate != null
  );
  const projectsWithContract = new Set(contractFiles.map((f) => f.projectId));

  const notifications: DashboardNotification[] = [
    ...paymentDueNotifications(allOrders, today),
    ...receiptDueNotifications(
      allInvoices,
      projectByIdForNotif,
      receiptSumByProject,
      today
    ),
    ...missingInvoiceNotifications(wonProjects, invoiceCountByProject),
    ...undeliveredOrderNotifications(allOrders),
    ...contractMissingNotifications(
      contractCheckProjects,
      projectsWithContract,
      today
    ),
  ];

  // server.js の /api/notifications には上記の実データ通知に加え、実データと無関係な
  // 固定20件の「デモ用テスト通知」（server.js:1676-1718、案件名・発注先名も本移行後のダミー値と
  // 不一致）が付加されていたが、実データを表す通知ではないため本移植では意図的に省略する。

  const order: Record<NotificationLevel, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  notifications.sort((a, b) => order[a.level] - order[b.level]);
  return notifications;
}

// ============ ダッシュボード サマリ（/api/dashboard 相当） ============

const RECEIVABLE_STATUSES = ["受注", "請求発行", "半金入金", "入金済"];

async function buildDashboardSummary() {
  const [allProjects, allOrders, allReceipts] = await Promise.all([
    db.query.projects.findMany({ where: isNull(projects.deletedAt) }),
    db.query.orders.findMany(),
    db.query.receipts.findMany(),
  ]);
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  );

  // 当月に稼働中の案件＝工期（startDate〜endDate）が当月とオーバーラップする案件
  const activeProjects = allProjects.filter((p) => {
    const st = parseD(p.startDate);
    const en = parseD(p.endDate);
    return st && en && st <= monthEnd && en >= monthStart;
  });
  const monthProjectIds = new Set(activeProjects.map((p) => p.id));

  let totalReceivable = 0;
  for (const p of activeProjects) {
    if (RECEIVABLE_STATUSES.includes(p.status ?? "")) {
      const received = allReceipts
        .filter((r) => r.projectId === p.id)
        .reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const outstanding = (Number(p.amount) || 0) - received;
      if (outstanding > 0) {
        totalReceivable += outstanding;
      }
    }
  }
  const totalPayable = allOrders
    .filter(
      (o) => monthProjectIds.has(o.projectId) && o.paymentStatus !== "支払済み"
    )
    .reduce((s, o) => s + (Number(o.decided) || 0), 0);

  // 翌月の年月
  const nd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextYm = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`;
  const allInvoices = await db.query.invoices.findMany();

  // 当月売上・当月利益（売上＝工期開始月の契約金額、利益＝売上−注文確定額）
  const monthRevProjects = allProjects.filter(
    (p) => ymOfDate(p.startDate) === ym
  );
  const monthRevIds = new Set(monthRevProjects.map((p) => p.id));
  const thisMonthRevenue = monthRevProjects.reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0
  );
  const thisMonthRevCost = allOrders
    .filter((o) => monthRevIds.has(o.projectId))
    .reduce((s, o) => s + (Number(o.decided) || 0), 0);
  const thisMonthProfit = thisMonthRevenue - thisMonthRevCost;

  // 入金予定＝請求書の支払期日が該当月のもの（請求総額）
  const dueSum = (m: string) =>
    allInvoices
      .filter((i) => i.dueDate?.startsWith(m))
      .reduce((s, i) => s + (Number(i.total) || 0), 0);
  const thisMonthReceipts = dueSum(ym);
  const nextMonthReceipts = dueSum(nextYm);

  // 支払予定＝注文の支払期日が該当月で未払いのもの
  const paySum = (m: string) =>
    allOrders
      .filter(
        (o) => o.paymentStatus !== "支払済み" && o.paymentDate?.startsWith(m)
      )
      .reduce((s, o) => s + (Number(o.decided) || 0), 0);
  const thisMonthPayments = paySum(ym);
  const nextMonthPayments = paySum(nextYm);

  // 未入金総金額＝（請求済み総額 − 入金済み総額）の正値合計（案件単位）
  let totalUnpaid = 0;
  for (const p of allProjects) {
    const billed = allInvoices
      .filter((i) => i.projectId === p.id)
      .reduce((s, i) => s + (Number(i.total) || 0), 0);
    const received = allReceipts
      .filter((r) => r.projectId === p.id)
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const outstanding = billed - received;
    if (outstanding > 0) {
      totalUnpaid += outstanding;
    }
  }

  const projectProfit = activeProjects.map((p) => {
    const po = allOrders.filter((o) => o.projectId === p.id);
    const cost = po.reduce((s, o) => s + (Number(o.decided) || 0), 0);
    const revenue = Number(p.amount) || 0;
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return {
      id: p.id,
      project_no: p.projectNo,
      name: p.name,
      revenue,
      cost,
      profit,
      margin: Math.round(margin * 10) / 10,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
    };
  });
  const totalRevenue = projectProfit.reduce((s, p) => s + p.revenue, 0);
  const totalCost = projectProfit.reduce((s, p) => s + p.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgMargin =
    totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0;

  return {
    month: ym,
    activeCount: activeProjects.length,
    totalReceivable,
    totalPayable,
    thisMonthRevenue,
    thisMonthProfit,
    thisMonthReceipts,
    thisMonthPayments,
    nextMonthReceipts,
    nextMonthPayments,
    totalUnpaid,
    totalRevenue,
    totalCost,
    totalProfit,
    avgMargin,
    projectProfit: projectProfit.sort((a, b) => b.revenue - a.revenue),
  };
}

// ============ レポート（受注・入金推移）：月次の売上・利益（/api/report/growth 相当） ============
// 売上＝案件の工期開始月に計上した契約金額、原価＝その案件の注文確定額、利益＝売上−原価。
// from/to（YYYY-MM）で対象期間可変。未指定時は当月から過去12ヶ月。

export interface GrowthReportPoint {
  profit: number;
  revenue: number;
  ym: string;
}

export interface GrowthReportData {
  from: string;
  points: GrowthReportPoint[];
  to: string;
  totalProfit: number;
  totalRevenue: number;
}

/**
 * 月次売上・利益推移データを取得する。dashboard.growth（tRPC）と
 * /api/report/growth-pdf（Route Handler）の両方から呼ばれる共通ロジック
 * （集計ロジックを重複させないため、ここに一本化している）。
 */
export async function getGrowthReportData(
  fromInput?: string,
  toInput?: string
): Promise<GrowthReportData> {
  const now = new Date();
  const to =
    toInput ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let from = fromInput;
  if (!from) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const [projectRows, orderRows] = await Promise.all([
    db.query.projects.findMany({ where: isNull(projects.deletedAt) }),
    db.query.orders.findMany(),
  ]);

  const projMonth = new Map<number, string | null>();
  const map = new Map<string, { revenue: number; cost: number }>();
  const ensure = (ymKey: string) => {
    let v = map.get(ymKey);
    if (!v) {
      v = { revenue: 0, cost: 0 };
      map.set(ymKey, v);
    }
    return v;
  };
  for (const p of projectRows) {
    const ymVal = ymOfDate(p.startDate);
    projMonth.set(p.id, ymVal);
    if (ymVal) {
      ensure(ymVal).revenue += Number(p.amount) || 0;
    }
  }
  for (const o of orderRows) {
    const ymVal = projMonth.get(o.projectId);
    if (ymVal) {
      ensure(ymVal).cost += Number(o.decided) || 0;
    }
  }

  const months = monthRange(from, to);
  const points: GrowthReportPoint[] = months.map((ymKey) => {
    const v = map.get(ymKey) || { revenue: 0, cost: 0 };
    return { ym: ymKey, revenue: v.revenue, profit: v.revenue - v.cost };
  });
  const totalRevenue = points.reduce((s, p) => s + p.revenue, 0);
  const totalProfit = points.reduce((s, p) => s + p.profit, 0);
  return { points, totalRevenue, totalProfit, from, to };
}

export const dashboardRouter = createTRPCRouter({
  notifications: protectedProcedure.query(() => buildNotifications()),

  summary: protectedProcedure.query(() => buildDashboardSummary()),

  growth: protectedProcedure
    .input(
      z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => getGrowthReportData(input?.from, input?.to)),
});
