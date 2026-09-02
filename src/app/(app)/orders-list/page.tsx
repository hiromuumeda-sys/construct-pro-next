"use client";

import {
  Columns3,
  Download,
  FileText,
  Plus,
  Send,
  Upload,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import {
  ORDER_STATUS_CLASS,
  orderRowState,
  PROJECT_STATUS_CLASS,
  statusClass,
} from "~/lib/status-styles";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type Order = RouterOutputs["orders"]["list"][number];
type Project = RouterOutputs["projects"]["list"][number];

const STATUSES = ["未処理", "見積待ち", "決定済み", "発注完了", "支払済み"];
const NUMERIC_ONLY_RE = /^\d+$/;
const CSV_NEEDS_QUOTING_RE = /[",\n]/;
const CSV_QUOTE_RE = /"/g;
const NOTES_EXCERPT_LEN = 20;

// ===== 表示項目（権限別デフォルト＋チェックボックスで個別に表示/非表示） =====
// 旧app orders-list.html の OPTIONAL_COLUMNS / defaultColumnState 相当。
// 原価に近い見積額・予定金額は管理者／経理部のみ既定表示、それ以外（一般社員等）は
// 既定非表示にする（role未確定の間も cost 系は非表示側に倒す＝安全側のデフォルト）。
const OPTIONAL_COLUMNS = ["category", "notes", "estimate", "planned"] as const;
type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];
type ColumnState = Record<OptionalColumn, boolean>;

function defaultColumnState(role: string | undefined): ColumnState {
  const canSeeCost = role === "admin" || role === "accounting";
  return {
    category: true,
    notes: true,
    estimate: canSeeCost,
    planned: canSeeCost,
  };
}

function columnStorageKey(role: string | undefined): string {
  return `orders-list-columns:${role ?? "user"}`;
}

function useColumnVisibility(role: string | undefined) {
  const [state, setState] = useState<ColumnState>(() =>
    defaultColumnState(role)
  );
  const appliedRoleRef = useRef<string | undefined | null>(null);

  useEffect(() => {
    if (appliedRoleRef.current === role) {
      return;
    }
    appliedRoleRef.current = role;
    try {
      const saved = localStorage.getItem(columnStorageKey(role));
      const parsed = saved ? (JSON.parse(saved) as Partial<ColumnState>) : null;
      setState({ ...defaultColumnState(role), ...parsed });
    } catch {
      setState(defaultColumnState(role));
    }
  }, [role]);

  const toggle = (key: OptionalColumn, checked: boolean) => {
    setState((prev) => {
      const next = { ...prev, [key]: checked };
      try {
        localStorage.setItem(columnStorageKey(role), JSON.stringify(next));
      } catch {
        /* noop：localStorage無効時は永続化のみ諦め、表示は継続する */
      }
      return next;
    });
  };

  return { state, toggle };
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return CSV_NEEDS_QUOTING_RE.test(s)
    ? `"${s.replace(CSV_QUOTE_RE, '""')}"`
    : s;
}

// 旧app orders-list.html exportOrdersCSV() の列構成をそのまま踏襲
const ORDER_CSV_COLUMNS: [string, keyof Order][] = [
  ["工事区分", "category"],
  ["発注先", "vendor"],
  ["見積額", "estimate"],
  ["予定金額", "planned"],
  ["決定金額", "decided"],
  ["ステータス", "status"],
  ["工事場所", "site"],
  ["工事開始日", "periodStart"],
  ["工事終了日", "periodEnd"],
  ["検査・引渡時期", "handover"],
  ["支払条件", "payment"],
  ["支払状況", "paymentStatus"],
  ["支払期日", "paymentDate"],
  ["工事内容", "details"],
];

function exportOrdersCsv(
  targetOrders: Order[],
  projectName: string,
  projectId: number
) {
  if (targetOrders.length === 0) {
    toast.error("出力する工事計画データがありません");
    return;
  }
  const header = ORDER_CSV_COLUMNS.map(([label]) => csvEscape(label)).join(",");
  const body = targetOrders
    .map((o) => ORDER_CSV_COLUMNS.map(([, key]) => csvEscape(o[key])).join(","))
    .join("\n");
  const blob = new Blob([`﻿${header}\n${body}\n`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `工事計画_${projectName || projectId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 備考列の20文字抜粋（旧app buildOrderRow のnotes列相当）。 */
function excerptNotes(details: string | null): string {
  if (!details) {
    return "-";
  }
  return details.length > NOTES_EXCERPT_LEN
    ? `${details.slice(0, NOTES_EXCERPT_LEN)}…`
    : details;
}

/** 発注先がその工事区分に対応するか。タグ未指定なら全工事区分で表示、1つでもあればその区分のみ（旧app vendorMatchesCategory 相当）。 */
function vendorMatchesCategory(
  v: { categories: string | null },
  categoryName: string
): boolean {
  const tags = (v.categories ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (tags.length === 0) {
    return true;
  }
  return Boolean(categoryName) && tags.includes(categoryName);
}

export default function OrdersListPage() {
  return (
    <Suspense>
      <OrdersListContent />
    </Suspense>
  );
}

function OrdersListContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  return projectId ? (
    <OrderDetailView projectId={Number(projectId)} />
  ) : (
    <ProjectSelectView />
  );
}

function ProjectSelectView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: projects, isLoading } = api.projects.list.useQuery();
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const filtered = useMemo(() => {
    if (!projects) {
      return [];
    }
    let rows = projects;
    const kw = keyword.trim();
    if (kw) {
      rows = NUMERIC_ONLY_RE.test(kw)
        ? rows.filter((p) => String(p.id) === kw)
        : rows.filter(
            (p) =>
              p.name.toLowerCase().includes(kw.toLowerCase()) ||
              p.client.toLowerCase().includes(kw.toLowerCase()) ||
              (p.projectNo ?? "").toLowerCase().includes(kw.toLowerCase())
          );
    }
    if (dateStart) {
      rows = rows.filter((p) => !p.startDate || p.startDate >= dateStart);
    }
    if (dateEnd) {
      rows = rows.filter((p) => !p.endDate || p.endDate <= dateEnd);
    }
    return rows;
  }, [projects, keyword, dateStart, dateEnd]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-bold text-2xl">工事計画</h1>
        <p className="text-muted-foreground text-sm">
          案件を選択して工事計画を管理します
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-sm">工期開始（以降）</Label>
        <Input
          className="w-40"
          onChange={(e) => setDateStart(e.target.value)}
          type="date"
          value={dateStart}
        />
        <Label className="whitespace-nowrap text-sm">工期終了（以前）</Label>
        <Input
          className="w-40"
          onChange={(e) => setDateEnd(e.target.value)}
          type="date"
          value={dateEnd}
        />
        <Input
          className="ml-auto w-64"
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="案件ID・工事名・発注元で検索"
          value={keyword}
        />
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案件ID</TableHead>
              <TableHead>工事名</TableHead>
              <TableHead>発注元</TableHead>
              <TableHead>工期</TableHead>
              <TableHead className="text-right">契約金額</TableHead>
              <TableHead>状態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`sk-${i.toString()}`}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={6}
                >
                  該当する案件がありません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow
                className="cursor-pointer"
                key={p.id}
                onClick={() => router.push(`/orders-list?projectId=${p.id}`)}
              >
                <TableCell className="tabular-nums">
                  {p.projectNo || "-"}
                </TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.client}</TableCell>
                <TableCell>
                  {p.startDate || "-"} 〜 {p.endDate || "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.amount == null ? "-" : `¥${p.amount.toLocaleString()}`}
                </TableCell>
                <TableCell>
                  <Badge
                    className={statusClass(PROJECT_STATUS_CLASS, p.status)}
                  >
                    {p.status || "-"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface OrderFormState {
  assignee: string;
  category: string;
  decided: string;
  details: string;
  estimate: string;
  handover: string;
  payment: string;
  periodEnd: string;
  periodStart: string;
  planned: string;
  site: string;
  status: string;
  vendor: string;
}

const EMPTY_ORDER_FORM: OrderFormState = {
  assignee: "",
  category: "",
  decided: "",
  details: "",
  estimate: "",
  handover: "",
  payment: "月末締翌月末払い",
  periodEnd: "",
  periodStart: "",
  planned: "",
  site: "",
  status: "未処理",
  vendor: "",
};

function toOrderForm(o: Order): OrderFormState {
  return {
    assignee: o.assignee ?? "",
    category: o.category ?? "",
    decided: o.decided == null ? "" : String(o.decided),
    details: o.details ?? "",
    estimate: o.estimate == null ? "" : String(o.estimate),
    handover: o.handover ?? "",
    payment: o.payment ?? "月末締翌月末払い",
    periodEnd: o.periodEnd ?? "",
    periodStart: o.periodStart ?? "",
    planned: o.planned == null ? "" : String(o.planned),
    site: o.site ?? "",
    status: o.status ?? "未処理",
    vendor: o.vendor ?? "",
  };
}

function OrderDetailView({ projectId }: { projectId: number }) {
  const utils = api.useUtils();
  const searchParams = useSearchParams();
  const { data: project } = api.projects.list.useQuery(undefined, {
    select: (rows) => rows.find((p) => p.id === projectId),
  });
  const { data: orders, isLoading } = api.orders.list.useQuery();
  const { data: categories } = api.categories.list.useQuery();
  const { data: vendors } = api.vendors.list.useQuery();
  const { data: me } = api.users.me.useQuery();
  const columns = useColumnVisibility(me?.role);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [editing, setEditing] = useState<Order | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<OrderFormState>(EMPTY_ORDER_FORM);
  const [poOrder, setPoOrder] = useState<Order | null>(null);

  const projectOrders = useMemo(
    () => (orders ?? []).filter((o) => o.projectId === projectId),
    [orders, projectId]
  );

  const filtered = useMemo(() => {
    let rows = projectOrders;
    if (categoryFilter !== "all") {
      rows = rows.filter((o) => o.category === categoryFilter);
    }
    if (statusFilter !== "all") {
      rows = rows.filter((o) => o.status === statusFilter);
    }
    const kw = keyword.trim().toLowerCase();
    if (kw) {
      rows = rows.filter(
        (o) =>
          (o.details ?? "").toLowerCase().includes(kw) ||
          (o.vendor ?? "").toLowerCase().includes(kw)
      );
    }
    return rows;
  }, [projectOrders, categoryFilter, statusFilter, keyword]);

  // 固定列（発注先/決定金額/ステータス/請求書/請書/注文書）6列 + トグル可能な列
  const visibleColumnCount = useMemo(
    () => 6 + Object.values(columns.state).filter(Boolean).length,
    [columns.state]
  );

  const summary = useMemo(() => {
    const costTotal = projectOrders.reduce((s, o) => s + (o.decided ?? 0), 0);
    const revenue = project?.amount ?? 0;
    return {
      revenue,
      cost: costTotal,
      profit: revenue - costTotal,
      margin: revenue
        ? (((revenue - costTotal) / revenue) * 100).toFixed(1)
        : "0.0",
    };
  }, [projectOrders, project]);

  const invalidate = () => utils.orders.list.invalidate();

  const createMutation = api.orders.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("発注を登録しました");
      setCreating(false);
    },
    onError: () => toast.error("登録に失敗しました"),
  });
  const updateMutation = api.orders.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("発注を更新しました");
      setEditing(null);
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error("他の人がこの発注を更新しました。再読み込みしてください");
        invalidate();
        return;
      }
      toast.error("更新に失敗しました");
    },
  });
  const deleteMutation = api.orders.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("発注を削除しました");
      setEditing(null);
    },
    onError: () => toast.error("削除に失敗しました"),
  });
  const updateStatusMutation = api.orders.update.useMutation({
    onSuccess: () => invalidate(),
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error("他の人がこの発注を更新しました。再読み込みしてください");
      }
      invalidate();
    },
  });

  const openCreate = () => {
    setForm(EMPTY_ORDER_FORM);
    setCreating(true);
  };
  const openEdit = (o: Order) => {
    setEditing(o);
    setForm(toOrderForm(o));
  };

  const numOrNull = (v: string) => (v ? Number(v) : null);

  const submitCreate = () => {
    if (!form.category) {
      toast.error("必須項目を入力してください");
      return;
    }
    createMutation.mutate({
      projectId,
      category: form.category,
      vendor: form.vendor,
      estimate: numOrNull(form.estimate),
      planned: numOrNull(form.planned),
      decided: numOrNull(form.decided),
      status: form.status,
      details: form.details,
      site: form.site,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      handover: form.handover,
      payment: form.payment,
      assignee: form.assignee,
    });
  };
  const submitUpdate = () => {
    if (!editing) {
      return;
    }
    updateMutation.mutate({
      id: editing.id,
      version: editing.version,
      category: form.category,
      vendor: form.vendor,
      estimate: numOrNull(form.estimate),
      planned: numOrNull(form.planned),
      decided: numOrNull(form.decided),
      status: form.status,
      details: form.details,
      site: form.site,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      handover: form.handover,
      payment: form.payment,
      assignee: form.assignee,
    });
  };

  const vendorOptions = useMemo(() => {
    if (!vendors) {
      return [];
    }
    if (!form.category) {
      return vendors;
    }
    return vendors.filter((v) => vendorMatchesCategory(v, form.category));
  }, [vendors, form.category]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">工事計画</h1>
          <p className="text-muted-foreground text-sm">
            {project
              ? `${project.projectNo} ${project.name}`
              : `案件 #${projectId}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() =>
              exportOrdersCsv(projectOrders, project?.name ?? "", projectId)
            }
            variant="outline"
          >
            <Download data-icon="inline-start" />
            CSV出力
          </Button>
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" />
            新規注文登録
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm">
              売上高
            </CardTitle>
          </CardHeader>
          <CardContent className="font-bold text-xl tabular-nums">
            ¥{summary.revenue.toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm">
              外注費合計
            </CardTitle>
          </CardHeader>
          <CardContent className="font-bold text-xl tabular-nums">
            ¥{summary.cost.toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm">
              想定利益額
            </CardTitle>
          </CardHeader>
          <CardContent className="font-bold text-xl tabular-nums">
            ¥{summary.profit.toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm">
              想定粗利率
            </CardTitle>
          </CardHeader>
          <CardContent className="font-bold text-xl tabular-nums">
            {summary.margin}%
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Select onValueChange={setCategoryFilter} value={categoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての工事区分</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={setStatusFilter} value={statusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのステータス</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-64"
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="工事内容・発注先で検索"
          value={keyword}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button className="ml-auto" variant="outline">
              <Columns3 data-icon="inline-start" />
              表示項目
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <div className="flex flex-col gap-3">
              {(
                [
                  ["category", "工事区分"],
                  ["notes", "備考"],
                  ["estimate", "見積額"],
                  ["planned", "予定金額"],
                ] as const
              ).map(([key, label]) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  htmlFor={`col-toggle-${key}`}
                  key={key}
                >
                  <Checkbox
                    checked={columns.state[key]}
                    id={`col-toggle-${key}`}
                    onCheckedChange={(checked) =>
                      columns.toggle(key, checked === true)
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.state.category && <TableHead>工事区分</TableHead>}
              <TableHead>発注先</TableHead>
              {columns.state.notes && <TableHead>備考</TableHead>}
              {columns.state.estimate && <TableHead>見積額</TableHead>}
              {columns.state.planned && <TableHead>予定金額</TableHead>}
              <TableHead className="bg-amber-50">決定金額</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>請求書</TableHead>
              <TableHead>請書</TableHead>
              <TableHead>注文書</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }, (_, i) => (
                <TableRow key={`sk-${i.toString()}`}>
                  <TableCell colSpan={visibleColumnCount}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={visibleColumnCount}
                >
                  発注明細がありません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((o) => (
              <OrderRow
                columns={columns.state}
                key={o.id}
                onOpenEdit={() => openEdit(o)}
                onOpenPo={() => setPoOrder(o)}
                onStatusChange={(status) =>
                  updateStatusMutation.mutate({
                    id: o.id,
                    version: o.version,
                    status,
                  })
                }
                order={o}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog onOpenChange={setCreating} open={creating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新規注文登録</DialogTitle>
          </DialogHeader>
          <OrderForm
            categories={categories}
            form={form}
            setForm={setForm}
            vendorOptions={vendorOptions}
          />
          <DialogFooter>
            <Button disabled={createMutation.isPending} onClick={submitCreate}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setEditing(null)}
        open={editing !== null}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>注文詳細の編集</DialogTitle>
          </DialogHeader>
          <OrderForm
            categories={categories}
            form={form}
            setForm={setForm}
            vendorOptions={vendorOptions}
          />
          <DialogFooter className="justify-between sm:justify-between">
            <Button
              disabled={deleteMutation.isPending}
              onClick={() =>
                editing && deleteMutation.mutate({ id: editing.id })
              }
              variant="destructive"
            >
              削除
            </Button>
            <Button disabled={updateMutation.isPending} onClick={submitUpdate}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {poOrder && (
        <PurchaseOrderModal
          onClose={() => setPoOrder(null)}
          order={poOrder}
          project={project}
        />
      )}
    </div>
  );
}

function OrderRow({
  columns,
  order: o,
  onOpenEdit,
  onOpenPo,
  onStatusChange,
}: {
  columns: ColumnState;
  order: Order;
  onOpenEdit: () => void;
  onOpenPo: () => void;
  onStatusChange: (status: string) => void;
}) {
  const rowState = orderRowState(o.status, o.invoiceHasFile);
  return (
    <TableRow className={cn("cursor-pointer", rowState.className)}>
      {columns.category && (
        <TableCell onClick={onOpenEdit}>{o.category || "-"}</TableCell>
      )}
      <TableCell onClick={onOpenEdit}>{o.vendor || "-"}</TableCell>
      {columns.notes && (
        <TableCell
          className="max-w-[220px] truncate"
          onClick={onOpenEdit}
          title={o.details ?? ""}
        >
          {excerptNotes(o.details)}
        </TableCell>
      )}
      {columns.estimate && (
        <TableCell className="tabular-nums" onClick={onOpenEdit}>
          {o.estimate == null ? "-" : `¥${o.estimate.toLocaleString()}`}
        </TableCell>
      )}
      {columns.planned && (
        <TableCell className="tabular-nums" onClick={onOpenEdit}>
          {o.planned == null ? "-" : `¥${o.planned.toLocaleString()}`}
        </TableCell>
      )}
      <TableCell className="bg-amber-50 tabular-nums" onClick={onOpenEdit}>
        {o.decided == null ? "-" : `¥${o.decided.toLocaleString()}`}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {rowState.locked ? (
          <Badge
            className={cn(
              "opacity-70",
              statusClass(ORDER_STATUS_CLASS, o.status)
            )}
            title="入金済みのため編集できません"
          >
            {o.status}
          </Badge>
        ) : (
          <Select onValueChange={onStatusChange} value={o.status ?? "未処理"}>
            <SelectTrigger
              className={cn(
                "w-32 border-transparent",
                statusClass(ORDER_STATUS_CLASS, o.status)
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <OrderFileCell kind="invoice" order={o} />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <OrderFileCell kind="ack" order={o} />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Button onClick={onOpenPo} size="sm" variant="outline">
          <FileText data-icon="inline-start" />
          注文書
        </Button>
      </TableCell>
    </TableRow>
  );
}

function OrderForm({
  categories,
  form,
  setForm,
  vendorOptions,
}: {
  categories: RouterOutputs["categories"]["list"] | undefined;
  form: OrderFormState;
  setForm: (f: OrderFormState) => void;
  vendorOptions: RouterOutputs["vendors"]["list"];
}) {
  const set = <K extends keyof OrderFormState>(
    key: K,
    value: OrderFormState[K]
  ) => setForm({ ...form, [key]: value });

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-2">
        <Label>工事区分 *</Label>
        <Select
          onValueChange={(v) => set("category", v)}
          value={form.category || undefined}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label>発注先</Label>
        <Select
          onValueChange={(v) => set("vendor", v)}
          value={form.vendor || undefined}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {vendorOptions.map((v) => (
              <SelectItem key={v.id} value={v.company}>
                {v.company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label>見積額</Label>
        <Input
          onChange={(e) => set("estimate", e.target.value)}
          type="number"
          value={form.estimate}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>予定金額</Label>
        <Input
          onChange={(e) => set("planned", e.target.value)}
          type="number"
          value={form.planned}
        />
      </div>
      <div className="flex flex-col gap-2 bg-amber-50 p-2">
        <Label>決定金額（経理確認用）</Label>
        <Input
          onChange={(e) => set("decided", e.target.value)}
          type="number"
          value={form.decided}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>ステータス</Label>
        <Select onValueChange={(v) => set("status", v)} value={form.status}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label>工事場所</Label>
        <Input
          onChange={(e) => set("site", e.target.value)}
          value={form.site}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>担当者</Label>
        <Input
          onChange={(e) => set("assignee", e.target.value)}
          placeholder="注文書・メールに表示される社内担当者名"
          value={form.assignee}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>工事開始日</Label>
        <Input
          onChange={(e) => set("periodStart", e.target.value)}
          type="date"
          value={form.periodStart}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>工事終了日</Label>
        <Input
          onChange={(e) => set("periodEnd", e.target.value)}
          type="date"
          value={form.periodEnd}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-2">
        <Label>検査・引渡時期</Label>
        <Input
          onChange={(e) => set("handover", e.target.value)}
          value={form.handover}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-2">
        <Label>支払条件</Label>
        <Input
          onChange={(e) => set("payment", e.target.value)}
          value={form.payment}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-2">
        <Label>工事内容</Label>
        <Textarea
          onChange={(e) => set("details", e.target.value)}
          value={form.details}
        />
      </div>
    </div>
  );
}

function OrderFileCell({
  kind,
  order,
}: {
  kind: "ack" | "invoice";
  order: Order;
}) {
  const utils = api.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasFile = kind === "invoice" ? order.invoiceHasFile : order.ackHasFile;
  const filename =
    kind === "invoice" ? order.invoiceFilename : order.ackFilename;

  const uploadMutation = api.orders.uploadFile.useMutation({
    onSuccess: async () => {
      await utils.orders.list.invalidate();
      toast.success("アップロードしました");
    },
    onError: () => toast.error("アップロードに失敗しました"),
  });
  const deleteMutation = api.orders.deleteFile.useMutation({
    onSuccess: async () => {
      await utils.orders.list.invalidate();
      toast.success("削除しました");
      setPreviewOpen(false);
    },
    onError: () => toast.error("削除に失敗しました"),
  });

  const MAX_SIZE = 3 * 1024 * 1024;

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("PDFファイルを指定してください");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("ファイルサイズは3MB以下にしてください");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      uploadMutation.mutate({
        id: order.id,
        kind,
        filename: file.name,
        dataUrl: String(reader.result),
      });
    };
    reader.readAsDataURL(file);
  };

  if (hasFile) {
    return (
      <>
        <Button
          onClick={() => setPreviewOpen(true)}
          size="sm"
          variant="outline"
        >
          {kind === "invoice" ? "請求書" : "請書"}
        </Button>
        <Dialog onOpenChange={setPreviewOpen} open={previewOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl">
            <DialogHeader>
              <DialogTitle>{filename}</DialogTitle>
            </DialogHeader>
            <iframe
              className="h-[70vh] w-full"
              src={`/api/orders/${order.id}/file/${kind}`}
              title={filename ?? kind}
            />
            <DialogFooter>
              <Button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: order.id, kind })}
                variant="destructive"
              >
                削除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <input
        accept="application/pdf"
        className="hidden"
        onChange={onFileSelected}
        ref={fileInputRef}
        type="file"
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        size="sm"
        variant="ghost"
      >
        <Upload data-icon="inline-start" />
        アップロード
      </Button>
    </>
  );
}

function PurchaseOrderModal({
  onClose,
  order,
  project,
}: {
  onClose: () => void;
  order: Order;
  project: Project | undefined;
}) {
  const utils = api.useUtils();
  const [orderNo, setOrderNo] = useState(order.orderNo);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState(
    `【${project?.name ?? ""}】発注書のご案内`
  );
  const [emailBody, setEmailBody] = useState(
    "いつもお世話になっております。\n発注書を添付いたします。ご確認のほどよろしくお願いいたします。"
  );
  const [attachAckFormat, setAttachAckFormat] = useState(false);
  const [sending, setSending] = useState(false);

  const ensureOrderNoMutation = api.orders.ensureOrderNo.useMutation({
    onSuccess: async (data) => {
      setOrderNo(data.orderNo);
      await utils.orders.list.invalidate();
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per opened order, not on every order.orderNo/mutate identity change
  useEffect(() => {
    if (!order.orderNo) {
      ensureOrderNoMutation.mutate({ id: order.id });
    }
  }, [order.id]);

  const download = () => {
    window.open(`/api/po/${order.id}`, "_blank");
  };

  const sendEmail = async () => {
    if (!(emailTo && emailSubject)) {
      toast.error("宛先と件名を入力してください");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/po/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
          attachAckFormat,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "送信に失敗しました");
        return;
      }
      toast.success("発注確定メールを送信しました");
      setShowEmailForm(false);
      await utils.orders.list.invalidate();
    } catch {
      toast.error("送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog onOpenChange={onClose} open>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>注文書プレビュー</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border p-4">
          <p className="text-center font-bold text-lg">注文書</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <p>工事ID: {orderNo || "採番中..."}</p>
            <p>発注先: {order.vendor || "-"}</p>
            <p>工事区分: {order.category || "-"}</p>
            <p>
              決定金額: ¥
              {(
                order.decided ??
                order.planned ??
                order.estimate ??
                0
              ).toLocaleString()}
            </p>
          </div>
        </div>
        {showEmailForm ? (
          <div className="flex flex-col gap-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">発注確定メール送信</p>
              <Button
                onClick={() => setShowEmailForm(false)}
                size="icon"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            </div>
            <Input
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="宛先メールアドレス"
              type="email"
              value={emailTo}
            />
            <Input
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="件名"
              value={emailSubject}
            />
            <Textarea
              onChange={(e) => setEmailBody(e.target.value)}
              value={emailBody}
            />
            <label
              className="flex items-center gap-2 text-sm"
              htmlFor="po-attach-ack"
            >
              <Checkbox
                checked={attachAckFormat}
                id="po-attach-ack"
                onCheckedChange={(checked) =>
                  setAttachAckFormat(checked === true)
                }
              />
              請書フォーマットを添付する
            </label>
            <Button disabled={sending} onClick={sendEmail}>
              <Send data-icon="inline-start" />
              送信
            </Button>
          </div>
        ) : (
          <DialogFooter>
            <Button onClick={() => setShowEmailForm(true)} variant="outline">
              <Send data-icon="inline-start" />
              メール送信
            </Button>
            <Button onClick={download}>
              <FileText data-icon="inline-start" />
              ダウンロード
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
