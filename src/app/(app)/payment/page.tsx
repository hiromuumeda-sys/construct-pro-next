"use client";

import { History, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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
import { api, type RouterOutputs } from "~/trpc/react";

type Order = RouterOutputs["orders"]["list"][number];
type PaymentRecord = RouterOutputs["payments"]["records"]["list"][number];
type MiscPayment = RouterOutputs["payments"]["misc"]["list"][number];

const PAYMENT_STATUSES = ["未払い", "部分払い", "支払済み"] as const;
const STATUS_FILTER_OPTIONS = ["すべて", ...PAYMENT_STATUSES] as const;

const DUE_SOON_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function money(n: number | null | undefined): string {
  return `¥${(n ?? 0).toLocaleString()}`;
}

function dueDateClass(dateStr: string | null | undefined): string {
  if (!dateStr) {
    return "";
  }
  const due = new Date(dateStr);
  if (Number.isNaN(due.getTime())) {
    return "";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((due.getTime() - today.getTime()) / MS_PER_DAY);
  if (diffDays < 0) {
    return "text-red-600 font-medium";
  }
  if (diffDays <= DUE_SOON_DAYS) {
    return "text-amber-600 font-medium";
  }
  return "";
}

export default function PaymentPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-bold text-2xl">支払管理</h1>
        <p className="text-muted-foreground text-sm">
          発注先への支払状況を管理します
        </p>
      </div>
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">工事支払</TabsTrigger>
          <TabsTrigger value="misc">工事外</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-4" value="orders">
          <OrderPaymentsTab />
        </TabsContent>
        <TabsContent className="mt-4" value="misc">
          <MiscPaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 工事支払 tab
// ---------------------------------------------------------------------------

function OrderPaymentsTab() {
  const utils = api.useUtils();
  const { data: orders, isLoading } = api.orders.list.useQuery();
  const { data: projects } = api.projects.list.useQuery();

  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTER_OPTIONS)[number]>("すべて");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [registerOrder, setRegisterOrder] = useState<Order | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});

  const projectMap = useMemo(() => {
    const m = new Map<number, RouterOutputs["projects"]["list"][number]>();
    for (const p of projects ?? []) {
      m.set(p.id, p);
    }
    return m;
  }, [projects]);

  const updateMutation = api.orders.update.useMutation({
    onSuccess: async () => {
      await utils.orders.list.invalidate();
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error("他の人がこの発注を更新しました。再読み込みしてください");
        utils.orders.list.invalidate();
        return;
      }
      toast.error("更新に失敗しました");
    },
  });

  const purchaseOrders = useMemo(
    () => (orders ?? []).filter((o) => o.vendor || o.category),
    [orders]
  );

  const filtered = useMemo(
    () =>
      purchaseOrders.filter((o) => {
        if (
          statusFilter !== "すべて" &&
          (o.paymentStatus ?? "未払い") !== statusFilter
        ) {
          return false;
        }
        if (dueFrom && (!o.paymentDate || o.paymentDate < dueFrom)) {
          return false;
        }
        if (dueTo && (!o.paymentDate || o.paymentDate > dueTo)) {
          return false;
        }
        return true;
      }),
    [purchaseOrders, statusFilter, dueFrom, dueTo]
  );

  const handleStatusChange = (order: Order, status: string) => {
    updateMutation.mutate({
      id: order.id,
      paymentStatus: status,
      version: order.version,
    });
  };

  const handleNotesBlur = (order: Order) => {
    const draft = notesDraft[order.id];
    if (draft === undefined || draft === (order.paymentNotes ?? "")) {
      return;
    }
    updateMutation.mutate({
      id: order.id,
      paymentNotes: draft,
      version: order.version,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-muted-foreground text-xs">ステータス</Label>
            <Select
              onValueChange={(v) =>
                setStatusFilter(v as (typeof STATUS_FILTER_OPTIONS)[number])
              }
              value={statusFilter}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-muted-foreground text-xs">
              支払期日（以降）
            </Label>
            <Input
              className="w-40"
              onChange={(e) => setDueFrom(e.target.value)}
              type="date"
              value={dueFrom}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-muted-foreground text-xs">
              支払期日（以前）
            </Label>
            <Input
              className="w-40"
              onChange={(e) => setDueTo(e.target.value)}
              type="date"
              value={dueTo}
            />
          </div>
        </div>
        <Button
          onClick={() => {
            window.location.href = "/api/export/payments";
          }}
          variant="outline"
        >
          CSV出力
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>案件ID</TableHead>
              <TableHead>工事名</TableHead>
              <TableHead>工事区分</TableHead>
              <TableHead>発注先</TableHead>
              <TableHead className="text-right">費用</TableHead>
              <TableHead className="text-right">残金</TableHead>
              <TableHead>支払期日</TableHead>
              <TableHead>支払ステータス</TableHead>
              <TableHead>支払履歴</TableHead>
              <TableHead>備考</TableHead>
              <TableHead>支払登録</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i.toString()}`}>
                  <TableCell colSpan={12}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={12}
                >
                  該当する発注がありません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((o) => {
              const project = projectMap.get(o.projectId);
              const notes = notesDraft[o.id] ?? o.paymentNotes ?? "";
              return (
                <TableRow key={o.id}>
                  <TableCell className="tabular-nums">
                    #{String(o.id).padStart(6, "0")}
                  </TableCell>
                  <TableCell>{project?.projectNo || "-"}</TableCell>
                  <TableCell>{project?.name || "-"}</TableCell>
                  <TableCell>{o.category || "-"}</TableCell>
                  <TableCell>{o.vendor || "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(o.decided)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(o.remaining ?? o.decided)}
                  </TableCell>
                  <TableCell className={dueDateClass(o.paymentDate)}>
                    {o.paymentDate || "-"}
                  </TableCell>
                  <TableCell>
                    <Select
                      onValueChange={(v) => handleStatusChange(o, v)}
                      value={o.paymentStatus ?? "未払い"}
                    >
                      <SelectTrigger className="w-32" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => setHistoryOrder(o)}
                      size="icon"
                      variant="ghost"
                    >
                      <History className="size-4" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-40"
                      onBlur={() => handleNotesBlur(o)}
                      onChange={(e) =>
                        setNotesDraft((prev) => ({
                          ...prev,
                          [o.id]: e.target.value,
                        }))
                      }
                      value={notes}
                    />
                  </TableCell>
                  <TableCell>
                    <Button onClick={() => setRegisterOrder(o)} size="sm">
                      支払登録
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PaymentHistoryDialog
        onOpenChange={(open) => !open && setHistoryOrder(null)}
        order={historyOrder}
        project={
          historyOrder ? projectMap.get(historyOrder.projectId) : undefined
        }
      />
      <PaymentRegisterDialog
        onOpenChange={(open) => !open && setRegisterOrder(null)}
        order={registerOrder}
      />
    </div>
  );
}

function PaymentHistoryDialog({
  order,
  project,
  onOpenChange,
}: {
  order: Order | null;
  project: RouterOutputs["projects"]["list"][number] | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const { data: records, isLoading } = api.payments.records.list.useQuery(
    undefined,
    { enabled: order !== null }
  );

  const deleteMutation = api.payments.records.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.payments.records.list.invalidate(),
        utils.orders.list.invalidate(),
      ]);
      toast.success("支払登録を取消しました");
    },
    onError: () => toast.error("取消に失敗しました"),
  });

  const filtered: PaymentRecord[] = useMemo(() => {
    if (!(order && records)) {
      return [];
    }
    return records.filter((r) => r.orderId === order.id);
  }, [records, order]);

  return (
    <Dialog onOpenChange={onOpenChange} open={order !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            支払履歴 {project?.name ? `- ${project.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {!isLoading && filtered.length === 0 && (
            <p className="text-muted-foreground text-sm">
              支払履歴はありません
            </p>
          )}
          {filtered.map((r) => (
            <div
              className="flex items-center justify-between rounded-md border px-3 py-2"
              key={r.id}
            >
              <div className="flex flex-col">
                <span className="tabular-nums">{money(r.amount)}</span>
                <span className="text-muted-foreground text-xs">
                  {r.paidDate || "-"} {r.note ? `／ ${r.note}` : ""}
                </span>
              </div>
              <Button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: r.id })}
                size="sm"
                variant="ghost"
              >
                取消
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentRegisterDialog({
  order,
  onOpenChange,
}: {
  order: Order | null;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [note, setNote] = useState("");

  const createMutation = api.payments.records.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.orders.list.invalidate(),
        utils.payments.records.list.invalidate(),
      ]);
      toast.success("支払を登録しました");
      onOpenChange(false);
    },
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN") {
        toast.error("支払登録の権限がありません");
        return;
      }
      toast.error(err.message || "登録に失敗しました");
    },
  });

  const remaining = order ? (order.remaining ?? order.decided ?? 0) : 0;

  // Dialog は open を親から渡されるだけの完全制御コンポーネントであり、親が
  // order をセットして programmatic に open=true へ切り替えても Radix の
  // onOpenChange は発火しない（内部の閉じる操作にのみ反応するため）。
  // そのため、行を切り替えて開き直したときにフォームをリセットするには
  // order の変化を直接監視する必要がある。
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the target order changes (by id), not on every background refetch of `order` (a new object each time orders.list refetches)
  useEffect(() => {
    if (order) {
      setAmount("");
      setPaidDate(new Date().toISOString().slice(0, 10));
      setNote("");
    }
  }, [order?.id]);

  const submit = () => {
    if (!order) {
      return;
    }
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      toast.error("支払額を入力してください");
      return;
    }
    createMutation.mutate({
      orderId: order.id,
      amount: value,
      paidDate: paidDate || undefined,
      note: note || undefined,
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={order !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>支払登録</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">発注先: </span>
                {order.vendor || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">費用: </span>
                <span className="tabular-nums">{money(order.decided)}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">現在の残金: </span>
                <span className="tabular-nums">{money(remaining)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>支払額</Label>
              <Input
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                value={amount}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => setAmount(String(Math.round(remaining / 2)))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  1/2支払
                </Button>
                <Button
                  onClick={() => setAmount(String(Math.round(remaining / 3)))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  1/3支払
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>支払日</Label>
              <Input
                onChange={(e) => setPaidDate(e.target.value)}
                type="date"
                value={paidDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>備考</Label>
              <Input onChange={(e) => setNote(e.target.value)} value={note} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button disabled={createMutation.isPending} onClick={submit}>
            登録
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 工事外 tab
// ---------------------------------------------------------------------------

interface MiscFormState {
  amount: string;
  category: string;
  notes: string;
  payee: string;
  paymentDate: string;
  status: string;
  type: string;
}

const EMPTY_MISC_FORM: MiscFormState = {
  category: "",
  type: "支払",
  payee: "",
  amount: "",
  paymentDate: "",
  status: "未払い",
  notes: "",
};

function toMiscFormState(m: MiscPayment): MiscFormState {
  return {
    category: m.category ?? "",
    type: m.type ?? "支払",
    payee: m.payee ?? "",
    amount: m.amount == null ? "" : String(m.amount),
    paymentDate: m.paymentDate ?? "",
    status: m.status ?? "未払い",
    notes: m.notes ?? "",
  };
}

function MiscPaymentsTab() {
  const utils = api.useUtils();
  const { data: miscPayments, isLoading } = api.payments.misc.list.useQuery();
  const [editing, setEditing] = useState<MiscPayment | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<MiscFormState>(EMPTY_MISC_FORM);

  const invalidate = () => utils.payments.misc.list.invalidate();

  const createMutation = api.payments.misc.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("登録しました");
      setCreating(false);
    },
    onError: () => toast.error("登録に失敗しました"),
  });
  const updateMutation = api.payments.misc.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("更新しました");
      setEditing(null);
    },
    onError: () => toast.error("更新に失敗しました"),
  });
  const deleteMutation = api.payments.misc.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("削除しました");
      setEditing(null);
    },
    onError: () => toast.error("削除に失敗しました"),
  });

  const openCreate = () => {
    setForm(EMPTY_MISC_FORM);
    setCreating(true);
  };
  const openEdit = (m: MiscPayment) => {
    setEditing(m);
    setForm(toMiscFormState(m));
  };

  const validate = () => {
    const value = Number(form.amount);
    if (!form.amount || Number.isNaN(value) || value <= 0) {
      toast.error("金額を入力してください");
      return null;
    }
    return value;
  };

  const submitCreate = () => {
    const value = validate();
    if (value === null) {
      return;
    }
    createMutation.mutate({ ...form, amount: value });
  };
  const submitUpdate = () => {
    if (!editing) {
      return;
    }
    const value = validate();
    if (value === null) {
      return;
    }
    updateMutation.mutate({ id: editing.id, ...form, amount: value });
  };

  return (
    <div className="flex flex-col gap-4">
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
              <TableHead>支払先</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>支払日</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>備考</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i.toString()}`}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && (miscPayments ?? []).length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={9}
                >
                  登録されていません
                </TableCell>
              </TableRow>
            )}
            {(miscPayments ?? []).map((m) => (
              <TableRow
                className="cursor-pointer"
                key={m.id}
                onClick={() => openEdit(m)}
              >
                <TableCell className="tabular-nums">
                  #{String(m.id).padStart(4, "0")}
                </TableCell>
                <TableCell>{m.type || "-"}</TableCell>
                <TableCell>{m.category || "-"}</TableCell>
                <TableCell>{m.payee || "-"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(m.amount)}
                </TableCell>
                <TableCell>{m.paymentDate || "-"}</TableCell>
                <TableCell>
                  <Badge
                    variant={m.status === "支払済み" ? "default" : "secondary"}
                  >
                    {m.status || "未払い"}
                  </Badge>
                </TableCell>
                <TableCell>{m.notes || "-"}</TableCell>
                <TableCell>
                  <Button
                    disabled={deleteMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate({ id: m.id });
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    削除
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
          <MiscPaymentForm form={form} setForm={setForm} />
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
            <DialogTitle>編集</DialogTitle>
          </DialogHeader>
          <MiscPaymentForm form={form} setForm={setForm} />
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

function MiscPaymentForm({
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
        <Input
          onChange={(e) => set("type", e.target.value)}
          value={form.type}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>区分</Label>
        <Input
          onChange={(e) => set("category", e.target.value)}
          value={form.category}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-2">
        <Label>支払先</Label>
        <Input
          onChange={(e) => set("payee", e.target.value)}
          value={form.payee}
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
        <Label>支払日</Label>
        <Input
          onChange={(e) => set("paymentDate", e.target.value)}
          type="date"
          value={form.paymentDate}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-2">
        <Label>ステータス</Label>
        <Select onValueChange={(v) => set("status", v)} value={form.status}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 flex flex-col gap-2">
        <Label>備考</Label>
        <Input
          onChange={(e) => set("notes", e.target.value)}
          value={form.notes}
        />
      </div>
    </div>
  );
}
