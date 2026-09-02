"use client";

import {
  AlertTriangle,
  Check,
  ClipboardList,
  FileText,
  Info,
  Plus,
  Receipt,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
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
import { PROJECT_STATUS_CLASS, statusClass } from "~/lib/status-styles";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type Project = RouterOutputs["projects"]["list"][number];
type Customer = RouterOutputs["customers"]["list"][number];
type OrderRow = RouterOutputs["orders"]["list"][number];

const STATUSES = ["未対応", "提案中", "見積確認中", "受注", "失注"];
const NUMERIC_ONLY_RE = /^\d+$/;
const ORDERED_STATUS = "オーダー移行";
const MAX_CONTRACT_FILE_SIZE = 3 * 1024 * 1024;
const PDF_EXTENSION_RE = /\.pdf$/i;
const OVERDUE_UNSIGNED_ROW_CLASS =
  "bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/30";

// 請求書の永続化(persistInvoice)は同一案件で二重発行しないよう、旧appのsavedInvoiceProjects Set
// と同じ考え方でセッション内メモリに保持する（モジュールスコープ＝ページ再読み込みでリセット）。
const persistedInvoiceProjects = new Set<number>();

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

function parseFreeTextDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const d = new Date(value.replaceAll("/", "-"));
  return Number.isNaN(d.getTime()) ? null : d;
}

// 工期が指定範囲（工期開始/工期終了フィルタ）に重なる案件のみを残す
function overlapsPeriod(
  p: Project,
  rStart: Date | null,
  rEnd: Date | null
): boolean {
  const st = parseFreeTextDate(p.startDate);
  const en = parseFreeTextDate(p.endDate);
  if (!(st && en)) {
    return false;
  }
  if (rStart && en < rStart) {
    return false;
  }
  return !(rEnd && st > rEnd);
}

// 着工日（工期開始）を過ぎているのに契約書が未締結（未アップロード）かどうか
function isOverdueUnsigned(p: Project): boolean {
  if (p.contractHasFile) {
    return false;
  }
  const start = parseFreeTextDate(p.startDate);
  if (!start) {
    return false;
  }
  const today = new Date(new Date().toDateString());
  return start < today;
}

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
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<EditFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<EditFormState>(EMPTY_FORM);
  const [estimateProject, setEstimateProject] = useState<Project | null>(null);
  const [invoiceProject, setInvoiceProject] = useState<Project | null>(null);
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
    if (periodStart || periodEnd) {
      const rStart = periodStart ? new Date(periodStart) : null;
      const rEnd = periodEnd ? new Date(periodEnd) : null;
      rows = rows.filter((p) => overlapsPeriod(p, rStart, rEnd));
    }
    return rows;
  }, [projects, statusFilter, keyword, periodStart, periodEnd]);

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
      setEditing(null);
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
      setEditing(null);
    },
    onError: () => toast.error("削除に失敗しました"),
  });
  const changeDeliveryMonthMutation =
    api.projects.changeDeliveryMonth.useMutation({
      onSuccess: async (data) => {
        await invalidate();
        toast.success(`新しい案件ID「${data.projectNo}」として複製しました`);
        setEditing(null);
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
    if (p.status === ORDERED_STATUS) {
      return;
    }
    setEditing(p);
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

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">ステータス</Label>
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
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">工期開始（以降）</Label>
          <Input
            className="w-40"
            onChange={(e) => setPeriodStart(e.target.value)}
            type="date"
            value={periodStart}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">工期終了（以前）</Label>
          <Input
            className="w-40"
            onChange={(e) => setPeriodEnd(e.target.value)}
            type="date"
            value={periodEnd}
          />
        </div>
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
              <TableHead>備考</TableHead>
              <TableHead>工期</TableHead>
              <TableHead>引渡月</TableHead>
              <TableHead>契約金額</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>工事計画</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`sk-${i.toString()}`}>
                  <TableCell colSpan={10}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={10}
                >
                  案件が登録されていません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) =>
              editing?.id === p.id ? (
                <ProjectEditRow
                  changeDeliveryMonthPending={
                    changeDeliveryMonthMutation.isPending
                  }
                  customers={customers}
                  form={form}
                  key={p.id}
                  onCancel={() => setEditing(null)}
                  onDelete={() => deleteMutation.mutate({ id: p.id })}
                  onSave={() => submitEdit(p)}
                  project={p}
                  savePending={updateMutation.isPending}
                  setForm={setForm}
                />
              ) : (
                <ProjectViewRow
                  customers={customers}
                  key={p.id}
                  onEdit={() => openEdit(p)}
                  onGenerateEstimate={() => setEstimateProject(p)}
                  onGenerateInvoice={() => setInvoiceProject(p)}
                  onStatusChange={(status) =>
                    updateStatusMutation.mutate({
                      id: p.id,
                      version: p.version,
                      status,
                    })
                  }
                  project={p}
                />
              )
            )}
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

      {estimateProject && (
        <EstimateModal
          onClose={() => setEstimateProject(null)}
          project={estimateProject}
        />
      )}

      {invoiceProject && (
        <InvoiceModal
          onClose={() => setInvoiceProject(null)}
          project={invoiceProject}
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
                  status: form.status,
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

function ClientInfoPopover({
  customers,
  project,
}: {
  customers: Customer[] | undefined;
  project: Project;
}) {
  const customer = customers?.find(
    (c) => c.company === (project.clientCompany || project.client)
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="クライアント情報を表示"
          className="text-muted-foreground/60 hover:text-primary"
          onClick={(e) => e.stopPropagation()}
          title="クライアント情報を表示"
          type="button"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {customer ? (
          <div className="flex flex-col gap-1.5">
            <p className="font-bold text-primary">{customer.company}</p>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider">
                資本金
              </p>
              <p>
                {customer.capital
                  ? `¥${customer.capital.toLocaleString()}`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider">
                企業規模
              </p>
              <p>{customer.companyScale || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider">
                サイト
              </p>
              {customer.website ? (
                <a
                  className="break-all text-primary hover:underline"
                  href={customer.website}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {customer.website}
                </a>
              ) : (
                <p>-</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">
            「{project.client}」の顧客マスタ登録がありません
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ContractFileCell({ project }: { project: Project }) {
  const utils = api.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const uploadMutation = api.projects.uploadContractFile.useMutation({
    onSuccess: async () => {
      await utils.projects.list.invalidate();
      toast.success("契約書をアップロードしました");
    },
    onError: (err) => toast.error(err.message || "アップロードに失敗しました"),
  });
  const deleteMutation = api.projects.deleteContractFile.useMutation({
    onSuccess: async () => {
      await utils.projects.list.invalidate();
      toast.success("契約書を削除しました");
      setPreviewOpen(false);
    },
    onError: () => toast.error("削除に失敗しました"),
  });

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    if (file.type !== "application/pdf" && !PDF_EXTENSION_RE.test(file.name)) {
      toast.error("PDFファイルを選択してください");
      return;
    }
    if (file.size > MAX_CONTRACT_FILE_SIZE) {
      toast.error(
        "ファイルサイズは3MBまでにしてください（サーバー制限）。大きいPDFは圧縮してからアップロードしてください。"
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      uploadMutation.mutate({
        id: project.id,
        filename: file.name,
        dataUrl: String(reader.result),
      });
    };
    reader.readAsDataURL(file);
  };

  if (project.contractHasFile) {
    return (
      <>
        <Button
          onClick={() => setPreviewOpen(true)}
          size="xs"
          variant="secondary"
        >
          <FileText data-icon="inline-start" />
          契約書
        </Button>
        <Dialog onOpenChange={setPreviewOpen} open={previewOpen}>
          <DialogContent className="max-h-[85vh] max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                契約書
                {project.contractFilename
                  ? `（${project.contractFilename}）`
                  : ""}
              </DialogTitle>
            </DialogHeader>
            <iframe
              className="h-[65vh] w-full rounded-md border"
              src={`/api/projects/${project.id}/file/contract#toolbar=1&view=FitH`}
              title="契約書PDF"
            />
            <DialogFooter className="justify-between sm:justify-between">
              <Button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: project.id })}
                variant="destructive"
              >
                <Trash2 data-icon="inline-start" />
                削除
              </Button>
              <Button onClick={() => setPreviewOpen(false)} variant="outline">
                閉じる
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (project.status === ORDERED_STATUS) {
    return null;
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
        disabled={uploadMutation.isPending}
        onClick={() => fileInputRef.current?.click()}
        size="xs"
        title="契約書が未締結です（未アップロード）"
        variant="destructive"
      >
        <Upload data-icon="inline-start" />
        契約書未締結
      </Button>
    </>
  );
}

function ProjectViewRow({
  customers,
  onEdit,
  onGenerateEstimate,
  onGenerateInvoice,
  onStatusChange,
  project: p,
}: {
  customers: Customer[] | undefined;
  onEdit: () => void;
  onGenerateEstimate: () => void;
  onGenerateInvoice: () => void;
  onStatusChange: (status: string) => void;
  project: Project;
}) {
  const locked = p.status === ORDERED_STATUS;
  const overdueUnsigned = !locked && isOverdueUnsigned(p);
  const rowClass = locked
    ? "opacity-50"
    : cn("cursor-pointer", overdueUnsigned && OVERDUE_UNSIGNED_ROW_CLASS);

  return (
    <TableRow className={rowClass} onClick={locked ? undefined : onEdit}>
      <TableCell className="tabular-nums">{p.projectNo || "-"}</TableCell>
      <TableCell className="max-w-56 truncate font-medium" title={p.name}>
        {p.name}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1">
          <span className="max-w-24 truncate" title={p.client}>
            {p.client}
          </span>
          <ClientInfoPopover customers={customers} project={p} />
        </span>
      </TableCell>
      <TableCell
        className="max-w-56 truncate text-muted-foreground"
        title={p.notes ?? ""}
      >
        {p.notes || "-"}
      </TableCell>
      <TableCell>
        {p.startDate || "-"} 〜 {p.endDate || "-"}
      </TableCell>
      <TableCell>{p.deliveryMonth || "-"}</TableCell>
      <TableCell className="tabular-nums">
        {p.amount == null ? "-" : `¥${p.amount.toLocaleString()}`}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {locked ? (
          <Badge className={statusClass(PROJECT_STATUS_CLASS, p.status)}>
            {p.status}
          </Badge>
        ) : (
          <Select onValueChange={onStatusChange} value={p.status ?? "未対応"}>
            <SelectTrigger
              className={cn(
                "w-32 border-transparent",
                statusClass(PROJECT_STATUS_CLASS, p.status)
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
        <div className="flex flex-wrap items-center gap-1">
          {!locked && (
            <>
              <Button onClick={onGenerateEstimate} size="xs" variant="outline">
                <FileText data-icon="inline-start" />
                見積書
              </Button>
              <Button onClick={onGenerateInvoice} size="xs" variant="outline">
                <Receipt data-icon="inline-start" />
                請求書
              </Button>
            </>
          )}
          <ContractFileCell project={p} />
          {overdueUnsigned && (
            <span
              className="text-amber-600 dark:text-amber-400"
              title="着工日を過ぎているのに契約書が未締結です"
            >
              <AlertTriangle className="size-4" />
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function ProjectEditRow({
  changeDeliveryMonthPending,
  customers,
  form,
  onCancel,
  onDelete,
  onSave,
  project: p,
  savePending,
  setForm,
}: {
  changeDeliveryMonthPending: boolean;
  customers: Customer[] | undefined;
  form: EditFormState;
  onCancel: () => void;
  onDelete: () => void;
  onSave: () => void;
  project: Project;
  savePending: boolean;
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
    <TableRow className="bg-secondary/10 ring-1 ring-secondary/30 ring-inset">
      <TableCell className="tabular-nums">{p.projectNo || "-"}</TableCell>
      <TableCell>
        <Input
          className="h-8"
          onChange={(e) => set("name", e.target.value)}
          value={form.name}
        />
      </TableCell>
      <TableCell>
        <Select
          onValueChange={onCustomerSelected}
          value={form.client || undefined}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="選択..." />
          </SelectTrigger>
          <SelectContent>
            {customers?.map((c) => (
              <SelectItem key={c.id} value={c.company}>
                {c.company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          className="h-8"
          onChange={(e) => set("notes", e.target.value)}
          value={form.notes}
        />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Input
            className="h-8"
            onChange={(e) => set("startDate", e.target.value)}
            type="date"
            value={form.startDate}
          />
          <Input
            className="h-8"
            onChange={(e) => set("endDate", e.target.value)}
            type="date"
            value={form.endDate}
          />
        </div>
      </TableCell>
      <TableCell>
        <Input
          className="h-8 w-28"
          onChange={(e) => set("deliveryMonth", e.target.value)}
          type="month"
          value={form.deliveryMonth}
        />
      </TableCell>
      <TableCell>
        <Input
          className="h-8 w-24 tabular-nums"
          onChange={(e) => set("amount", e.target.value)}
          type="number"
          value={form.amount}
        />
      </TableCell>
      <TableCell>
        <Select onValueChange={(v) => set("status", v)} value={form.status}>
          <SelectTrigger
            className={cn(
              "h-8 w-32 border-transparent",
              statusClass(PROJECT_STATUS_CLASS, form.status)
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
      </TableCell>
      <TableCell className="text-muted-foreground/40">
        <ClipboardList className="size-4" />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <Button
            disabled={savePending || changeDeliveryMonthPending}
            onClick={onSave}
            size="xs"
          >
            <Check data-icon="inline-start" />
            保存
          </Button>
          <Button onClick={onCancel} size="xs" variant="secondary">
            <X data-icon="inline-start" />
            キャンセル
          </Button>
          <Button onClick={onDelete} size="xs" variant="destructive">
            <Trash2 data-icon="inline-start" />
            削除
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ProjectForm({
  customers,
  form,
  setForm,
}: {
  customers: Customer[] | undefined;
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

interface LineItemForm {
  name: string;
  note: string;
  price: number;
  qty: number;
  unit: string;
}

function initialLineItems(
  project: Project,
  orders: OrderRow[] | undefined,
  isInvoice: boolean
): LineItemForm[] {
  const rows = (orders ?? []).filter((o) => o.projectId === project.id);
  const amountOf = (o: OrderRow) =>
    isInvoice ? (o.decided ?? 0) : (o.estimate ?? o.planned ?? o.decided ?? 0);
  const total = rows.reduce((s, o) => s + amountOf(o), 0);
  return [{ name: project.name, qty: 1, unit: "式", price: total, note: "" }];
}

function computeTotals(items: LineItemForm[]) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
  const tax = Math.floor(subtotal * 0.1);
  return { subtotal, tax, total: subtotal + tax };
}

function LineItemsEditor({
  items,
  setItems,
}: {
  items: LineItemForm[];
  setItems: (items: LineItemForm[]) => void;
}) {
  const update = <K extends keyof LineItemForm>(
    index: number,
    key: K,
    value: LineItemForm[K]
  ) => {
    const next = items.slice();
    const current = next[index];
    if (!current) {
      return;
    }
    next[index] = { ...current, [key]: value };
    setItems(next);
  };
  const remove = (index: number) =>
    setItems(items.filter((_, i) => i !== index));
  const add = () =>
    setItems([...items, { name: "", qty: 1, unit: "式", price: 0, note: "" }]);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>品名</TableHead>
              <TableHead className="w-16">数量</TableHead>
              <TableHead className="w-16">単位</TableHead>
              <TableHead className="w-28">単価</TableHead>
              <TableHead className="w-28 text-right">金額</TableHead>
              <TableHead>摘要</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={7}
                >
                  明細がありません
                </TableCell>
              </TableRow>
            )}
            {items.map((it, i) => (
              <TableRow key={`item-${i.toString()}`}>
                <TableCell>
                  <Input
                    className="h-8"
                    onChange={(e) => update(i, "name", e.target.value)}
                    value={it.name}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 tabular-nums"
                    onChange={(e) =>
                      update(i, "qty", Number(e.target.value) || 0)
                    }
                    type="number"
                    value={it.qty}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8"
                    onChange={(e) => update(i, "unit", e.target.value)}
                    value={it.unit}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 tabular-nums"
                    onChange={(e) =>
                      update(i, "price", Number(e.target.value) || 0)
                    }
                    type="number"
                    value={it.price}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ¥{(it.qty * it.price).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8"
                    onChange={(e) => update(i, "note", e.target.value)}
                    value={it.note}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    onClick={() => remove(i)}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <X />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button className="w-fit" onClick={add} size="sm" variant="ghost">
        <Plus data-icon="inline-start" />
        行を追加
      </Button>
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
  const { data: allOrders } = api.orders.list.useQuery();
  const [items, setItems] = useState<LineItemForm[]>(() =>
    initialLineItems(project, allOrders, false)
  );
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailTo, setEmailTo] = useState(project.clientEmail ?? "");
  const [emailSubject, setEmailSubject] = useState(
    `【${project.name}】お見積りのご案内`
  );
  const [emailBody, setEmailBody] = useState(
    "いつもお世話になっております。\nお見積書を添付いたします。ご確認のほどよろしくお願いいたします。"
  );
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { subtotal, tax, total } = computeTotals(items);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/estimate/project/${project.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        throw new Error("failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `estimate-${project.id}.pdf`;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("ダウンロードに失敗しました");
    } finally {
      setDownloading(false);
    }
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
          items,
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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>見積書プレビュー</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <div className="flex justify-between text-sm">
            <div>
              <p className="font-bold">
                {project.clientCompany || project.client} 御中
              </p>
              <p className="text-muted-foreground">件名: {project.name}</p>
            </div>
            <div className="text-right text-muted-foreground text-xs">
              <p>見積№　EST-{String(project.id).padStart(3, "0")}</p>
              <p>有効期限：発行日より30日間</p>
            </div>
          </div>
          <LineItemsEditor items={items} setItems={setItems} />
          <div className="flex justify-end">
            <table className="text-sm">
              <tbody>
                <tr>
                  <td className="px-3 py-1 text-muted-foreground">小計</td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    ¥{subtotal.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1 text-muted-foreground">
                    消費税(10%)
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    ¥{tax.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1 font-bold">御見積金額</td>
                  <td className="px-3 py-1 text-right font-bold tabular-nums">
                    ¥{total.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
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
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowEmailForm(false)} variant="outline">
                キャンセル
              </Button>
              <Button disabled={sending} onClick={sendEmail}>
                <Send data-icon="inline-start" />
                送信
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button onClick={() => setShowEmailForm(true)} variant="outline">
              <Send data-icon="inline-start" />
              メール送信
            </Button>
            <Button disabled={downloading} onClick={download}>
              <FileText data-icon="inline-start" />
              ダウンロード
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

const INVOICE_VARIANTS = [
  { value: "sealed", label: "電子印あり原本（メール用）" },
  { value: "unsealed", label: "電子印なし原本（郵送用）" },
  { value: "copy", label: "控え（自社保管用）" },
] as const;
type InvoiceVariant = (typeof INVOICE_VARIANTS)[number]["value"];
const INVOICE_VARIANT_FILE_SUFFIX: Record<InvoiceVariant, string> = {
  sealed: "",
  unsealed: "-unsealed",
  copy: "-copy",
};

function InvoiceModal({
  onClose,
  project,
}: {
  onClose: () => void;
  project: Project;
}) {
  const { data: allOrders } = api.orders.list.useQuery();
  const { data: companyInfo } = api.company.info.useQuery();
  const [items, setItems] = useState<LineItemForm[]>(() =>
    initialLineItems(project, allOrders, true)
  );
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [emailTo, setEmailTo] = useState(project.clientEmail ?? "");
  const [emailSubject, setEmailSubject] = useState(
    `【請求書送付】${project.name}`
  );
  const [emailBody, setEmailBody] = useState(
    `${project.clientCompany || project.client} ご担当者様\n\n平素より大変お世話になっております。\n「${project.name}」につきまして、請求書を添付のとおりお送りいたします。\nお手数ですが、ご査収のほどよろしくお願い申し上げます。`
  );
  const [sending, setSending] = useState(false);
  const [downloadingVariant, setDownloadingVariant] =
    useState<InvoiceVariant | null>(null);

  const { subtotal, tax, total } = computeTotals(items);

  const persistMutation = api.invoices.create.useMutation();
  const persistInvoice = () => {
    if (persistedInvoiceProjects.has(project.id)) {
      return;
    }
    persistedInvoiceProjects.add(project.id);
    persistMutation.mutate({ projectId: project.id });
  };

  const download = async (variant: InvoiceVariant) => {
    setDownloadingVariant(variant);
    setDownloadMenuOpen(false);
    try {
      const res = await fetch(`/api/invoice/project/${project.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, variant }),
      });
      if (!res.ok) {
        throw new Error("failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${project.id}${INVOICE_VARIANT_FILE_SUFFIX[variant]}.pdf`;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      persistInvoice();
    } catch {
      toast.error("ダウンロードに失敗しました");
    } finally {
      setDownloadingVariant(null);
    }
  };

  const sendEmail = async () => {
    if (!(emailTo && emailSubject)) {
      toast.error("宛先と件名を入力してください");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/invoice/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
          items,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "送信に失敗しました");
        return;
      }
      persistInvoice();
      toast.success("請求書を送信しました");
      setShowEmailForm(false);
    } catch {
      toast.error("送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog onOpenChange={onClose} open>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>請求書プレビュー</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <div className="flex justify-between text-sm">
            <div>
              <p className="font-bold">
                {project.clientCompany || project.client} 御中
              </p>
              <p className="text-muted-foreground">件名: {project.name}</p>
            </div>
            <div className="text-right text-muted-foreground text-xs">
              <p>請求№　WW-{String(project.id).padStart(3, "0")}</p>
              <p>お支払期限：発行日より30日以内</p>
            </div>
          </div>
          <LineItemsEditor items={items} setItems={setItems} />
          <div className="flex justify-end">
            <table className="text-sm">
              <tbody>
                <tr>
                  <td className="px-3 py-1 text-muted-foreground">小計</td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    ¥{subtotal.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1 text-muted-foreground">
                    消費税(10%)
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    ¥{tax.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1 font-bold">合計金額（税込）</td>
                  <td className="px-3 py-1 text-right font-bold tabular-nums">
                    ¥{total.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {companyInfo && (
            <p className="text-muted-foreground text-xs">
              [振込先]　{companyInfo.bank}　／　口座番号　{companyInfo.account}
              　／　口座名義　{companyInfo.accountHolder}　※
              {companyInfo.feeNote}
            </p>
          )}
        </div>
        {showEmailForm ? (
          <div className="flex flex-col gap-3 rounded-md border p-4">
            <p className="font-medium text-sm">請求書メール送信</p>
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
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowEmailForm(false)} variant="outline">
                キャンセル
              </Button>
              <Button disabled={sending} onClick={sendEmail}>
                <Send data-icon="inline-start" />
                送信
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button onClick={() => setShowEmailForm(true)} variant="outline">
              <Send data-icon="inline-start" />
              メール送信
            </Button>
            <Popover onOpenChange={setDownloadMenuOpen} open={downloadMenuOpen}>
              <PopoverTrigger asChild>
                <Button disabled={downloadingVariant !== null}>
                  <FileText data-icon="inline-start" />
                  ダウンロード
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-1">
                {INVOICE_VARIANTS.map((v) => (
                  <button
                    className="w-full rounded px-3 py-2 text-left text-sm hover:bg-accent"
                    disabled={downloadingVariant !== null}
                    key={v.value}
                    onClick={() => download(v.value)}
                    type="button"
                  >
                    {v.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
