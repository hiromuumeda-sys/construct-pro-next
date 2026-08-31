"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
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
import { api, type RouterOutputs } from "~/trpc/react";

type VendorListItem = RouterOutputs["vendors"]["list"][number];
type VendorDetail = RouterOutputs["vendors"]["getById"];

interface FormState {
  address: string;
  bankBranch: string;
  bankHolder: string;
  bankName: string;
  bankNumber: string;
  bankType: string;
  capital: string;
  categories: string;
  company: string;
  companyScale: string;
  contact: string;
  dept: string;
  email: string;
  phone: string;
  website: string;
}

const EMPTY_FORM: FormState = {
  address: "",
  bankBranch: "",
  bankHolder: "",
  bankName: "",
  bankNumber: "",
  bankType: "",
  capital: "",
  categories: "",
  company: "",
  companyScale: "",
  contact: "",
  dept: "",
  email: "",
  phone: "",
  website: "",
};

function toFormState(v: VendorDetail): FormState {
  return {
    address: v.address ?? "",
    bankBranch: v.bankBranch ?? "",
    bankHolder: v.bankHolder ?? "",
    bankName: v.bankName ?? "",
    bankNumber: v.bankNumber ?? "",
    bankType: v.bankType ?? "",
    capital: v.capital == null ? "" : String(v.capital),
    categories: v.categories ?? "",
    company: v.company,
    companyScale: v.companyScale ?? "",
    contact: v.contact ?? "",
    dept: v.dept ?? "",
    email: v.email ?? "",
    phone: v.phone ?? "",
    website: v.website ?? "",
  };
}

function parseCategories(categories: string | null): string[] {
  if (!categories) {
    return [];
  }
  return categories
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export default function VendorsPage() {
  const utils = api.useUtils();
  const { data: vendors, isLoading } = api.vendors.list.useQuery();
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<VendorDetail | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createMutation = api.vendors.create.useMutation({
    onSuccess: async () => {
      await utils.vendors.list.invalidate();
      toast.success("発注先を登録しました");
      setCreating(false);
    },
    onError: () => toast.error("登録に失敗しました"),
  });
  const updateMutation = api.vendors.update.useMutation({
    onSuccess: async () => {
      await utils.vendors.list.invalidate();
      toast.success("発注先を更新しました");
      setEditing(null);
    },
    onError: () => toast.error("更新に失敗しました"),
  });
  const deleteMutation = api.vendors.delete.useMutation({
    onSuccess: async () => {
      await utils.vendors.list.invalidate();
      toast.success("発注先を削除しました");
      setEditing(null);
    },
    onError: () => toast.error("削除に失敗しました"),
  });

  const filtered = useMemo(() => {
    if (!vendors) {
      return [];
    }
    const kw = keyword.trim().toLowerCase();
    if (!kw) {
      return vendors;
    }
    return vendors.filter(
      (v) =>
        v.company.toLowerCase().includes(kw) ||
        (v.contact ?? "").toLowerCase().includes(kw)
    );
  }, [vendors, keyword]);

  const openEdit = async (row: VendorListItem) => {
    // 一覧の口座番号はマスク済みのため、編集時は getById で必ずフルの値を取得し直す
    setLoadingDetailId(row.id);
    try {
      const full = await utils.vendors.getById.fetch({ id: row.id });
      setForm(toFormState(full));
      setEditing(full);
    } catch {
      toast.error("発注先情報の取得に失敗しました");
    } finally {
      setLoadingDetailId(null);
    }
  };
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setCreating(true);
  };

  const submitCreate = () => {
    if (!form.company.trim()) {
      toast.error("必須項目を入力してください");
      return;
    }
    createMutation.mutate({
      ...form,
      capital: form.capital ? Number(form.capital) : null,
    });
  };
  const submitUpdate = () => {
    if (!editing) {
      return;
    }
    updateMutation.mutate({
      id: editing.id,
      ...form,
      capital: form.capital ? Number(form.capital) : null,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">発注先マスタ</h1>
          <p className="text-muted-foreground text-sm">
            工事を発注する協力会社・仕入先を管理します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-56"
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="会社名・担当者名で検索"
            value={keyword}
          />
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" />
            新規発注先登録
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>会社名</TableHead>
              <TableHead>部署名</TableHead>
              <TableHead>担当者名</TableHead>
              <TableHead>連絡先</TableHead>
              <TableHead>資本金</TableHead>
              <TableHead>企業規模</TableHead>
              <TableHead>対応工事区分</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i.toString()}`}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={8}
                >
                  発注先が登録されていません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((v) => (
              <TableRow
                aria-disabled={loadingDetailId === v.id}
                className="cursor-pointer"
                key={v.id}
                onClick={() => openEdit(v)}
              >
                <TableCell className="tabular-nums">#{v.id}</TableCell>
                <TableCell className="font-medium">{v.company}</TableCell>
                <TableCell>{v.dept || "-"}</TableCell>
                <TableCell>{v.contact || "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{v.email || "-"}</span>
                    {v.phone && (
                      <span className="text-muted-foreground text-xs">
                        {v.phone}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {v.capital == null ? "-" : `¥${v.capital.toLocaleString()}`}
                </TableCell>
                <TableCell>{v.companyScale || "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {parseCategories(v.categories).length > 0 ? (
                      parseCategories(v.categories).map((c) => (
                        <Badge key={c} variant="secondary">
                          {c}
                        </Badge>
                      ))
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog onOpenChange={setCreating} open={creating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>新規発注先登録</DialogTitle>
          </DialogHeader>
          <VendorForm form={form} setForm={setForm} />
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>発注先情報を編集</DialogTitle>
          </DialogHeader>
          <VendorForm form={form} setForm={setForm} />
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

function VendorForm({
  form,
  setForm,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm({ ...form, [key]: value });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex flex-col gap-2">
          <Label>会社名 *</Label>
          <Input
            onChange={(e) => set("company", e.target.value)}
            value={form.company}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>部署名</Label>
          <Input
            onChange={(e) => set("dept", e.target.value)}
            value={form.dept}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>担当者名</Label>
          <Input
            onChange={(e) => set("contact", e.target.value)}
            value={form.contact}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>メールアドレス</Label>
          <Input
            onChange={(e) => set("email", e.target.value)}
            type="email"
            value={form.email}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>電話番号</Label>
          <Input
            onChange={(e) => set("phone", e.target.value)}
            type="tel"
            value={form.phone}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-2">
          <Label>住所</Label>
          <Input
            onChange={(e) => set("address", e.target.value)}
            value={form.address}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>資本金</Label>
          <Input
            onChange={(e) => set("capital", e.target.value)}
            type="number"
            value={form.capital}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>企業規模（従業員数）</Label>
          <Input
            onChange={(e) => set("companyScale", e.target.value)}
            value={form.companyScale}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-2">
          <Label>コーポレートサイト</Label>
          <Input
            onChange={(e) => set("website", e.target.value)}
            type="url"
            value={form.website}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-2">
          <Label>対応工事区分</Label>
          <Input
            onChange={(e) => set("categories", e.target.value)}
            placeholder="カンマ区切りで入力（例: 電気工事, 内装工事）"
            value={form.categories}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-md border p-4">
        <h3 className="font-medium text-sm">振込先口座情報</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>銀行名</Label>
            <Input
              onChange={(e) => set("bankName", e.target.value)}
              value={form.bankName}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>支店名</Label>
            <Input
              onChange={(e) => set("bankBranch", e.target.value)}
              value={form.bankBranch}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>預金種別</Label>
            <Select
              onValueChange={(v) => set("bankType", v)}
              value={form.bankType}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="普通">普通</SelectItem>
                <SelectItem value="当座">当座</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>口座番号</Label>
            <Input
              onChange={(e) => set("bankNumber", e.target.value)}
              value={form.bankNumber}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <Label>口座名義</Label>
            <Input
              onChange={(e) => set("bankHolder", e.target.value)}
              value={form.bankHolder}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
