"use client";

import { History, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import {
  RECEIPT_STATUS_CLASS,
  receiptRowHighlightClass,
  statusClass,
} from "~/lib/status-styles";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type SalesRow = RouterOutputs["receipts"]["salesSummary"][number];
type ReceiptRow = RouterOutputs["receipts"]["list"][number];
type MiscRow = RouterOutputs["receipts"]["misc"]["list"][number];

const PAY_STATUS_OPTIONS = ["未入金", "一部入金", "入金済"] as const;
const PROJECT_TABLE_COLUMN_COUNT = 14;
const MISC_TABLE_COLUMN_COUNT = 9;

function yen(n: number | null | undefined) {
  return `¥${(n ?? 0).toLocaleString()}`;
}

export default function ReceiptsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-bold text-2xl">売上・入金管理</h1>
        <p className="text-muted-foreground text-sm">
          案件ごとの入金状況および案件外の入出金を管理します
        </p>
      </div>
      <Tabs defaultValue="project">
        <TabsList>
          <TabsTrigger value="project">案件</TabsTrigger>
          <TabsTrigger value="misc">案件外</TabsTrigger>
        </TabsList>
        <TabsContent value="project">
          <ProjectReceiptsTab />
        </TabsContent>
        <TabsContent value="misc">
          <MiscReceiptsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface RegisterForm {
  amount: string;
  memo: string;
  month: string;
  receivedDate: string;
}

const EMPTY_REGISTER_FORM: RegisterForm = {
  receivedDate: "",
  month: "",
  amount: "",
  memo: "",
};

function ProjectReceiptsTab() {
  const utils = api.useUtils();
  const { data: rows, isLoading } = api.receipts.salesSummary.useQuery();
  const { data: allReceipts } = api.receipts.list.useQuery();

  const [statusFilter, setStatusFilter] = useState("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");

  const [historyProject, setHistoryProject] = useState<SalesRow | null>(null);
  const [registerProject, setRegisterProject] = useState<SalesRow | null>(null);
  const [detailProject, setDetailProject] = useState<SalesRow | null>(null);
  const [registerForm, setRegisterForm] =
    useState<RegisterForm>(EMPTY_REGISTER_FORM);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});

  const invalidateAll = () =>
    Promise.all([
      utils.receipts.list.invalidate(),
      utils.receipts.salesSummary.invalidate(),
    ]);

  const createReceiptMutation = api.receipts.create.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      toast.success("入金を登録しました");
      setRegisterProject(null);
    },
    onError: () => toast.error("登録に失敗しました"),
  });

  const deleteReceiptMutation = api.receipts.delete.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      toast.success("入金を削除しました");
    },
    onError: () => toast.error("削除に失敗しました"),
  });

  const updateNotesMutation = api.projects.updateReceiptNotes.useMutation({
    onSuccess: () => invalidateAll(),
    onError: () => toast.error("備考の更新に失敗しました"),
  });

  const handleNotesBlur = (row: SalesRow) => {
    const draft = notesDraft[row.id];
    if (draft === undefined || draft === (row.receiptNotes ?? "")) {
      return;
    }
    updateNotesMutation.mutate({ id: row.id, value: draft });
  };

  const filtered = useMemo(() => {
    if (!rows) {
      return [];
    }
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.payStatus !== statusFilter) {
        return false;
      }
      if (dueFrom && (!r.dueDate || r.dueDate < dueFrom)) {
        return false;
      }
      if (dueTo && (!r.dueDate || r.dueDate > dueTo)) {
        return false;
      }
      return true;
    });
  }, [rows, statusFilter, dueFrom, dueTo]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          contract: acc.contract + (r.contractAmount || 0),
          received: acc.received + (r.cumReceived || 0),
          completedReceivable:
            acc.completedReceivable + (r.completedReceivable || 0),
        }),
        { contract: 0, received: 0, completedReceivable: 0 }
      ),
    [filtered]
  );

  const openRegister = (row: SalesRow) => {
    setRegisterForm(EMPTY_REGISTER_FORM);
    setRegisterProject(row);
  };

  const submitRegister = () => {
    if (!(registerForm.receivedDate.trim() && registerForm.amount.trim())) {
      toast.error("入金日と入金額は必須です");
      return;
    }
    const amount = Number(registerForm.amount);
    if (!(amount > 0)) {
      toast.error("金額を入力してください");
      return;
    }
    if (!registerProject) {
      return;
    }
    createReceiptMutation.mutate({
      projectId: registerProject.id,
      receivedDate: registerForm.receivedDate,
      amount,
      month: registerForm.month || null,
      memo: registerForm.memo || null,
    });
  };

  const historyReceipts: ReceiptRow[] = useMemo(() => {
    if (!(historyProject && allReceipts)) {
      return [];
    }
    return allReceipts.filter((r) => r.projectId === historyProject.id);
  }, [allReceipts, historyProject]);

  const exportCsv = () => {
    window.location.href = "/api/export/sales";
  };

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-normal text-muted-foreground text-sm">
              請負金額合計
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-2xl tabular-nums">
              {yen(totals.contract)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-normal text-muted-foreground text-sm">
              入金累計
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-2xl tabular-nums">
              {yen(totals.received)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-normal text-muted-foreground text-sm">
              完成工事未収入金
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-2xl tabular-nums">
              {yen(totals.completedReceivable)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">入金ステータス</Label>
          <Select onValueChange={setStatusFilter} value={statusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {PAY_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">入金期日（以降）</Label>
          <Input
            className="w-40"
            onChange={(e) => setDueFrom(e.target.value)}
            type="date"
            value={dueFrom}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">入金期日（以前）</Label>
          <Input
            className="w-40"
            onChange={(e) => setDueTo(e.target.value)}
            type="date"
            value={dueTo}
          />
        </div>
        <Button className="ml-auto" onClick={exportCsv} variant="outline">
          CSV出力
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案件ID</TableHead>
              <TableHead>発注者</TableHead>
              <TableHead>工事名</TableHead>
              <TableHead>請求書発行状態</TableHead>
              <TableHead className="text-right">請負金額</TableHead>
              <TableHead className="text-right">当月入金額</TableHead>
              <TableHead className="text-right">前月までの入金額</TableHead>
              <TableHead className="text-right">入金額累計</TableHead>
              <TableHead className="text-right">完成工事未収入金</TableHead>
              <TableHead className="text-right">未成工事受入金</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>備考</TableHead>
              <TableHead>消し込み履歴</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i.toString()}`}>
                  <TableCell colSpan={PROJECT_TABLE_COLUMN_COUNT}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={PROJECT_TABLE_COLUMN_COUNT}
                >
                  該当する案件がありません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow
                className={cn(
                  "cursor-pointer",
                  receiptRowHighlightClass(r.payStatus)
                )}
                key={r.id}
                onClick={() => setDetailProject(r)}
              >
                <TableCell className="tabular-nums">
                  {r.projectNo || `#${r.id}`}
                </TableCell>
                <TableCell>{r.client || "-"}</TableCell>
                <TableCell className="font-medium">{r.name || "-"}</TableCell>
                <TableCell>
                  <Badge variant={r.invoiceIssued ? "default" : "outline"}>
                    {r.invoiceIssued ? "発行済み" : "未発行"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(r.contractAmount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(r.thisMonthReceived)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(r.prevReceived)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(r.cumReceived)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(r.completedReceivable)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(r.advanceReceived)}
                </TableCell>
                <TableCell>
                  <Badge
                    className={statusClass(RECEIPT_STATUS_CLASS, r.payStatus)}
                  >
                    {r.payStatus}
                  </Badge>
                </TableCell>
                <TableCell
                  className="max-w-48"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Input
                    className="h-8"
                    onBlur={() => handleNotesBlur(r)}
                    onChange={(e) =>
                      setNotesDraft((prev) => ({
                        ...prev,
                        [r.id]: e.target.value,
                      }))
                    }
                    value={notesDraft[r.id] ?? r.receiptNotes ?? ""}
                  />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    onClick={() => setHistoryProject(r)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <History />
                  </Button>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    onClick={() => openRegister(r)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Plus />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        onOpenChange={(open) => !open && setRegisterProject(null)}
        open={registerProject !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              入金登録{registerProject ? `（${registerProject.name}）` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>入金日 *</Label>
              <Input
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    receivedDate: e.target.value,
                  })
                }
                type="date"
                value={registerForm.receivedDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>対象月度</Label>
              <Input
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, month: e.target.value })
                }
                type="month"
                value={registerForm.month}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>入金額 *</Label>
              <Input
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, amount: e.target.value })
                }
                type="number"
                value={registerForm.amount}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>備考</Label>
              <Textarea
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, memo: e.target.value })
                }
                value={registerForm.memo}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={createReceiptMutation.isPending}
              onClick={submitRegister}
            >
              登録
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setHistoryProject(null)}
        open={historyProject !== null}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              消し込み履歴{historyProject ? `（${historyProject.name}）` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>入金日</TableHead>
                  <TableHead>対象月度</TableHead>
                  <TableHead className="text-right">入金額</TableHead>
                  <TableHead>備考</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyReceipts.length === 0 && (
                  <TableRow>
                    <TableCell
                      className="text-center text-muted-foreground"
                      colSpan={5}
                    >
                      入金履歴がありません
                    </TableCell>
                  </TableRow>
                )}
                {historyReceipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.receivedDate || "-"}</TableCell>
                    <TableCell>{r.month || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {yen(r.amount)}
                    </TableCell>
                    <TableCell>{r.memo || "-"}</TableCell>
                    <TableCell>
                      <Button
                        disabled={deleteReceiptMutation.isPending}
                        onClick={() =>
                          deleteReceiptMutation.mutate({ id: r.id })
                        }
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setDetailProject(null)}
        open={detailProject !== null}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>売上・入金 明細</DialogTitle>
          </DialogHeader>
          {detailProject && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-muted-foreground text-xs">工事名</p>
                <p className="font-bold">{detailProject.name || "-"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">案件ID</p>
                  <p className="tabular-nums">
                    {detailProject.projectNo || `#${detailProject.id}`}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">発注者</p>
                  <p>{detailProject.client || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">契約</p>
                  <p>{detailProject.status || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">請求書</p>
                  <p>{detailProject.invoiceIssued ? "発行済み" : "未発行"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">未完/入金日</p>
                  <p>
                    {detailProject.completed
                      ? detailProject.lastReceiptDate || "完成"
                      : "未完"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    入金ステータス
                  </p>
                  <Badge
                    className={statusClass(
                      RECEIPT_STATUS_CLASS,
                      detailProject.payStatus
                    )}
                  >
                    {detailProject.payStatus}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">請負金額</p>
                  <p className="font-bold tabular-nums">
                    {yen(detailProject.contractAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">入金額累計</p>
                  <p className="tabular-nums">
                    {yen(detailProject.cumReceived)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">当月入金額</p>
                  <p className="tabular-nums">
                    {yen(detailProject.thisMonthReceived)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    前月までの入金額
                  </p>
                  <p className="tabular-nums">
                    {yen(detailProject.prevReceived)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    完成工事未収入金
                  </p>
                  <p className="tabular-nums">
                    {yen(detailProject.completedReceivable)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    未成工事受入金
                  </p>
                  <p className="tabular-nums">
                    {yen(detailProject.advanceReceived)}
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                ※
                案件情報は「受注一覧」で管理されます。入金登録は一覧の＋ボタンから行えます。
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailProject(null)} variant="outline">
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MiscFormState {
  amount: string;
  category: string;
  notes: string;
  payer: string;
  receiptDate: string;
  status: string;
  type: string;
}

const EMPTY_MISC_FORM: MiscFormState = {
  category: "",
  type: "入金",
  payer: "",
  amount: "",
  receiptDate: "",
  status: "",
  notes: "",
};

function toMiscForm(m: MiscRow): MiscFormState {
  return {
    category: m.category ?? "",
    type: m.type ?? "入金",
    payer: m.payer ?? "",
    amount: m.amount == null ? "" : String(m.amount),
    receiptDate: m.receiptDate ?? "",
    status: m.status ?? "",
    notes: m.notes ?? "",
  };
}

function MiscReceiptsTab() {
  const utils = api.useUtils();
  const { data: rows, isLoading } = api.receipts.misc.list.useQuery();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MiscRow | null>(null);
  const [form, setForm] = useState<MiscFormState>(EMPTY_MISC_FORM);

  const createMutation = api.receipts.misc.create.useMutation({
    onSuccess: async () => {
      await utils.receipts.misc.list.invalidate();
      toast.success("入出金を登録しました");
      setCreating(false);
    },
    onError: () => toast.error("登録に失敗しました"),
  });
  const updateMutation = api.receipts.misc.update.useMutation({
    onSuccess: async () => {
      await utils.receipts.misc.list.invalidate();
      toast.success("入出金を更新しました");
      setEditing(null);
    },
    onError: () => toast.error("更新に失敗しました"),
  });
  const deleteMutation = api.receipts.misc.delete.useMutation({
    onSuccess: async () => {
      await utils.receipts.misc.list.invalidate();
      toast.success("入出金を削除しました");
      setEditing(null);
    },
    onError: () => toast.error("削除に失敗しました"),
  });

  const openCreate = () => {
    setForm(EMPTY_MISC_FORM);
    setCreating(true);
  };
  const openEdit = (row: MiscRow) => {
    setForm(toMiscForm(row));
    setEditing(row);
  };

  const validateAmount = () => {
    const amount = Number(form.amount);
    if (!(amount > 0)) {
      toast.error("金額を入力してください");
      return null;
    }
    return amount;
  };

  const submitCreate = () => {
    const amount = validateAmount();
    if (amount === null) {
      return;
    }
    createMutation.mutate({ ...form, amount });
  };
  const submitUpdate = () => {
    if (!editing) {
      return;
    }
    const amount = validateAmount();
    if (amount === null) {
      return;
    }
    updateMutation.mutate({ id: editing.id, ...form, amount });
  };

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          新規登録
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>種別</TableHead>
              <TableHead>区分</TableHead>
              <TableHead>入金元</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>入金日</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>備考</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i.toString()}`}>
                  <TableCell colSpan={MISC_TABLE_COLUMN_COUNT}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && (!rows || rows.length === 0) && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={MISC_TABLE_COLUMN_COUNT}
                >
                  案件外の入出金は登録されていません
                </TableCell>
              </TableRow>
            )}
            {rows?.map((m) => (
              <TableRow
                className="cursor-pointer"
                key={m.id}
                onClick={() => openEdit(m)}
              >
                <TableCell className="tabular-nums">#{m.id}</TableCell>
                <TableCell>
                  <Badge
                    variant={m.type === "返金" ? "destructive" : "default"}
                  >
                    {m.type || "-"}
                  </Badge>
                </TableCell>
                <TableCell>{m.category || "-"}</TableCell>
                <TableCell>{m.payer || "-"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(m.amount)}
                </TableCell>
                <TableCell>{m.receiptDate || "-"}</TableCell>
                <TableCell>{m.status || "-"}</TableCell>
                <TableCell className="max-w-48 truncate">
                  {m.notes || "-"}
                </TableCell>
                <TableCell>
                  <Button
                    disabled={deleteMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate({ id: m.id });
                    }}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog onOpenChange={setCreating} open={creating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規登録</DialogTitle>
          </DialogHeader>
          <MiscReceiptForm form={form} setForm={setForm} />
          <DialogFooter>
            <Button disabled={createMutation.isPending} onClick={submitCreate}>
              登録
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setEditing(null)}
        open={editing !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>入出金を編集</DialogTitle>
          </DialogHeader>
          <MiscReceiptForm form={form} setForm={setForm} />
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
    </div>
  );
}

function MiscReceiptForm({
  form,
  setForm,
}: {
  form: MiscFormState;
  setForm: (f: MiscFormState) => void;
}) {
  const set = <K extends keyof MiscFormState>(
    key: K,
    value: MiscFormState[K]
  ) => setForm({ ...form, [key]: value });

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-2">
        <Label>種別</Label>
        <Select onValueChange={(v) => set("type", v)} value={form.type}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="入金">入金</SelectItem>
            <SelectItem value="返金">返金</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label>区分</Label>
        <Input
          onChange={(e) => set("category", e.target.value)}
          value={form.category}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>入金元</Label>
        <Input
          onChange={(e) => set("payer", e.target.value)}
          value={form.payer}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>金額 *</Label>
        <Input
          onChange={(e) => set("amount", e.target.value)}
          type="number"
          value={form.amount}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>入金日</Label>
        <Input
          onChange={(e) => set("receiptDate", e.target.value)}
          type="date"
          value={form.receiptDate}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>ステータス</Label>
        <Input
          onChange={(e) => set("status", e.target.value)}
          value={form.status}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-2">
        <Label>備考</Label>
        <Textarea
          onChange={(e) => set("notes", e.target.value)}
          value={form.notes}
        />
      </div>
    </div>
  );
}
