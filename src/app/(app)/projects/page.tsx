"use client";

import { ClipboardList, FileText, Plus, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
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
import { Textarea } from "~/components/ui/textarea";
import { api, type RouterOutputs } from "~/trpc/react";

type Project = RouterOutputs["projects"]["list"][number];

const STATUSES = ["未対応", "提案中", "見積確認中", "受注", "失注"];
const NUMERIC_ONLY_RE = /^\d+$/;

interface EditFormState {
  amount: string;
  client: string;
  clientCompany: string;
  deliveryMonth: string;
  endDate: string;
  name: string;
  notes: string;
  startDate: string;
  status: string;
}

function toEditForm(p: Project): EditFormState {
  return {
    amount: p.amount == null ? "" : String(p.amount),
    client: p.client,
    clientCompany: p.clientCompany ?? "",
    deliveryMonth: p.deliveryMonth ?? "",
    endDate: p.endDate ?? "",
    name: p.name,
    notes: p.notes ?? "",
    startDate: p.startDate ?? "",
    status: p.status ?? "未対応",
  };
}

const EMPTY_FORM: EditFormState = {
  amount: "",
  client: "",
  clientCompany: "",
  deliveryMonth: "",
  endDate: "",
  name: "",
  notes: "",
  startDate: "",
  status: "未対応",
};

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsContent />
    </Suspense>
  );
}

function ProjectsContent() {
  const utils = api.useUtils();
  const searchParams = useSearchParams();
  const { data: customers } = api.customers.list.useQuery();
  const { data: projects, isLoading } = api.projects.list.useQuery();

  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EditFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<EditFormState>(EMPTY_FORM);
  const [estimateProject, setEstimateProject] = useState<Project | null>(null);
  const [pendingDeliveryChange, setPendingDeliveryChange] =
    useState<Project | null>(null);

  const filtered = useMemo(() => {
    if (!projects) {
      return [];
    }
    let rows = projects;
    if (statusFilter !== "all") {
      rows = rows.filter((p) => p.status === statusFilter);
    }
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
    return rows;
  }, [projects, statusFilter, keyword]);

  const invalidate = () => utils.projects.list.invalidate();

  const createMutation = api.projects.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("案件を登録しました");
      setCreating(false);
    },
    onError: () => toast.error("登録に失敗しました"),
  });
  const updateMutation = api.projects.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("案件を更新しました");
      setEditingId(null);
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error("他の人がこの案件を更新しました。再読み込みしてください");
        invalidate();
        return;
      }
      toast.error(err.message || "更新に失敗しました");
    },
  });
  const deleteMutation = api.projects.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("案件を削除しました");
      setEditingId(null);
    },
    onError: () => toast.error("削除に失敗しました"),
  });
  const changeDeliveryMonthMutation =
    api.projects.changeDeliveryMonth.useMutation({
      onSuccess: async (data) => {
        await invalidate();
        toast.success(`新しい案件ID「${data.projectNo}」として複製しました`);
        setEditingId(null);
      },
      onError: (err) => toast.error(err.message || "複製に失敗しました"),
    });
  const updateStatusMutation = api.projects.update.useMutation({
    onSuccess: () => invalidate(),
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error("他の人がこの案件を更新しました。再読み込みしてください");
      }
      invalidate();
    },
  });

  const openEdit = (p: Project) => {
    if (p.status === "オーダー移行") {
      return;
    }
    setEditingId(p.id);
    setForm(toEditForm(p));
  };

  const submitEdit = (p: Project) => {
    if (!(form.name.trim() && form.client.trim())) {
      toast.error("必須項目を入力してください");
      return;
    }
    if (form.deliveryMonth !== (p.deliveryMonth ?? "")) {
      setPendingDeliveryChange(p);
      return;
    }
    updateMutation.mutate({
      id: p.id,
      version: p.version,
      name: form.name,
      client: form.client,
      clientCompany: form.clientCompany,
      amount: form.amount ? Number(form.amount) : null,
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status,
      notes: form.notes,
    });
  };

  const submitCreate = () => {
    if (
      !(
        createForm.name.trim() &&
        createForm.client.trim() &&
        createForm.deliveryMonth
      )
    ) {
      toast.error("必須項目（工事名・顧客・引渡月）を入力してください");
      return;
    }
    createMutation.mutate({
      name: createForm.name,
      client: createForm.client,
      clientCompany: createForm.clientCompany,
      amount: createForm.amount ? Number(createForm.amount) : null,
      startDate: createForm.startDate,
      endDate: createForm.endDate,
      status: createForm.status,
      notes: createForm.notes,
      deliveryMonth: createForm.deliveryMonth,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">受注一覧</h1>
          <p className="text-muted-foreground text-sm">
            案件（受注）の一覧管理・進行管理を行います
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateForm(EMPTY_FORM);
            setCreating(true);
          }}
        >
          <Plus data-icon="inline-start" />
          新規案件登録
        </Button>
      </div>

      <div className="flex items-center gap-2">
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
              <TableHead>引渡月</TableHead>
              <TableHead>契約金額</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>工事計画</TableHead>
              <TableHead>見積書</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`sk-${i.toString()}`}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={9}
                >
                  案件が登録されていません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => {
              const locked = p.status === "オーダー移行";
              return (
                <TableRow
                  className={locked ? "opacity-50" : "cursor-pointer"}
                  key={p.id}
                  onClick={() => openEdit(p)}
                >
                  <TableCell className="tabular-nums">
                    {p.projectNo || "-"}
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.client}</TableCell>
                  <TableCell>
                    {p.startDate || "-"} 〜 {p.endDate || "-"}
                  </TableCell>
                  <TableCell>{p.deliveryMonth || "-"}</TableCell>
                  <TableCell className="tabular-nums">
                    {p.amount == null ? "-" : `¥${p.amount.toLocaleString()}`}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {locked ? (
                      <Badge variant="secondary">{p.status}</Badge>
                    ) : (
                      <Select
                        onValueChange={(v) =>
                          updateStatusMutation.mutate({
                            id: p.id,
                            version: p.version,
                            status: v,
                          })
                        }
                        value={p.status ?? "未対応"}
                      >
                        <SelectTrigger className="w-32">
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
                    {locked ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <Link href={`/orders-list?projectId=${p.id}`}>
                        <Button size="sm" variant="ghost">
                          <ClipboardList data-icon="inline-start" />
                          工事計画
                        </Button>
                      </Link>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {locked ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <Button
                        onClick={() => setEstimateProject(p)}
                        size="sm"
                        variant="outline"
                      >
                        <FileText data-icon="inline-start" />
                        見積書
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog onOpenChange={setCreating} open={creating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新規案件登録</DialogTitle>
          </DialogHeader>
          <ProjectForm
            customers={customers}
            form={createForm}
            setForm={setCreateForm}
          />
          <DialogFooter>
            <Button disabled={createMutation.isPending} onClick={submitCreate}>
              登録
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setEditingId(null)}
        open={editingId !== null}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>案件情報を編集</DialogTitle>
          </DialogHeader>
          <ProjectForm customers={customers} form={form} setForm={setForm} />
          <DialogFooter className="justify-between sm:justify-between">
            <Button
              disabled={deleteMutation.isPending}
              onClick={() =>
                editingId !== null && deleteMutation.mutate({ id: editingId })
              }
              variant="destructive"
            >
              削除
            </Button>
            <Button
              disabled={
                updateMutation.isPending ||
                changeDeliveryMonthMutation.isPending
              }
              onClick={() => {
                const p = filtered.find((row) => row.id === editingId);
                if (p) {
                  submitEdit(p);
                }
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {estimateProject && (
        <EstimateModal
          onClose={() => setEstimateProject(null)}
          project={estimateProject}
        />
      )}

      <AlertDialog
        onOpenChange={(open) => !open && setPendingDeliveryChange(null)}
        open={pendingDeliveryChange !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>引渡月を変更しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              引渡月を変更すると、この案件は新しい案件IDのレコードとして複製されます。複製元の案件IDは「オーダー移行」ステータスとなり、以後編集できなくなります。続行しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDeliveryChange) {
                  return;
                }
                changeDeliveryMonthMutation.mutate({
                  id: pendingDeliveryChange.id,
                  deliveryMonth: form.deliveryMonth,
                  name: form.name,
                  client: form.client,
                  clientCompany: form.clientCompany,
                  amount: form.amount ? Number(form.amount) : null,
                  startDate: form.startDate,
                  endDate: form.endDate,
                  notes: form.notes,
                });
                setPendingDeliveryChange(null);
              }}
            >
              続行する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProjectForm({
  customers,
  form,
  setForm,
}: {
  customers: RouterOutputs["customers"]["list"] | undefined;
  form: EditFormState;
  setForm: (f: EditFormState) => void;
}) {
  const set = <K extends keyof EditFormState>(
    key: K,
    value: EditFormState[K]
  ) => setForm({ ...form, [key]: value });

  const onCustomerSelected = (company: string) => {
    setForm({ ...form, client: company, clientCompany: company });
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 flex flex-col gap-2">
        <Label>工事名 *</Label>
        <Input
          onChange={(e) => set("name", e.target.value)}
          value={form.name}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>顧客 *</Label>
        <Select
          onValueChange={onCustomerSelected}
          value={form.client || undefined}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {customers?.map((c) => (
              <SelectItem key={c.id} value={c.company}>
                {c.company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Label>契約金額</Label>
        <Input
          onChange={(e) => set("amount", e.target.value)}
          type="number"
          value={form.amount}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>引渡月 *</Label>
        <Input
          onChange={(e) => set("deliveryMonth", e.target.value)}
          type="month"
          value={form.deliveryMonth}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>工期開始</Label>
        <Input
          onChange={(e) => set("startDate", e.target.value)}
          type="date"
          value={form.startDate}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>工期終了</Label>
        <Input
          onChange={(e) => set("endDate", e.target.value)}
          type="date"
          value={form.endDate}
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

function EstimateModal({
  onClose,
  project,
}: {
  onClose: () => void;
  project: Project;
}) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailTo, setEmailTo] = useState(project.clientEmail ?? "");
  const [emailSubject, setEmailSubject] = useState(
    `【${project.name}】お見積りのご案内`
  );
  const [emailBody, setEmailBody] = useState(
    "いつもお世話になっております。\nお見積書を添付いたします。ご確認のほどよろしくお願いいたします。"
  );
  const [sending, setSending] = useState(false);

  const download = () => {
    window.open(`/api/estimate/project/${project.id}`, "_blank");
  };

  const sendEmail = async () => {
    if (!(emailTo && emailSubject)) {
      toast.error("宛先と件名を入力してください");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/estimate/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "送信に失敗しました");
        return;
      }
      toast.success("見積書を送信しました");
      setShowEmailForm(false);
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
          <DialogTitle>見積書プレビュー</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border p-4">
          <p className="text-center font-bold text-lg">見積書</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <p>案件: {project.name}</p>
            <p>宛先: {project.clientCompany || project.client}</p>
            <p>
              御見積金額: ¥
              {Math.floor((project.amount ?? 0) * 1.1).toLocaleString()}
              （税込）
            </p>
          </div>
        </div>
        {showEmailForm ? (
          <div className="flex flex-col gap-3 rounded-md border p-4">
            <p className="font-medium text-sm">見積書メール送信</p>
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
