"use client";

import { useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api, type RouterOutputs } from "~/trpc/react";

type Growth = RouterOutputs["dashboard"]["growth"];
type Order = RouterOutputs["orders"]["list"][number];

function yen(v: number | null | undefined) {
  return `¥${Math.round(v ?? 0).toLocaleString()}`;
}

function pct(v: number | null | undefined) {
  return `${(v ?? 0).toFixed(1)}%`;
}

export default function ReportingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-bold text-2xl">レポーティング</h1>
        <p className="text-muted-foreground text-sm">
          予実・入出金の見込みと、発注状況の傾向を確認します
        </p>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">予実・残高・当月予定</TabsTrigger>
          <TabsTrigger value="growth">レポート分析</TabsTrigger>
          <TabsTrigger value="vendors">企業別発注金額一覧</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <SummaryTab />
        </TabsContent>
        <TabsContent value="growth">
          <GrowthTab />
        </TabsContent>
        <TabsContent value="vendors">
          <VendorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="font-bold text-2xl tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryTab() {
  const { data, isLoading } = api.dashboard.summary.useQuery();

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div>
        <h2 className="mb-2 font-semibold text-sm">
          当月予実（{data?.month ?? "-"}）
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard
            isLoading={isLoading}
            label="当月売上"
            value={yen(data?.thisMonthRevenue)}
          />
          <StatCard
            isLoading={isLoading}
            label="当月利益"
            value={yen(data?.thisMonthProfit)}
          />
          <StatCard
            isLoading={isLoading}
            label="当月稼働案件数"
            value={`${data?.activeCount ?? 0}件`}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold text-sm">残高</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard
            isLoading={isLoading}
            label="未回収金額（当月稼働案件）"
            value={yen(data?.totalReceivable)}
          />
          <StatCard
            isLoading={isLoading}
            label="未払金額（当月稼働案件）"
            value={yen(data?.totalPayable)}
          />
          <StatCard
            isLoading={isLoading}
            label="未入金総額（全案件）"
            value={yen(data?.totalUnpaid)}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold text-sm">当月・来月の入出金予定</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard
            isLoading={isLoading}
            label="当月入金予定"
            value={yen(data?.thisMonthReceipts)}
          />
          <StatCard
            isLoading={isLoading}
            label="当月支払予定"
            value={yen(data?.thisMonthPayments)}
          />
          <StatCard
            isLoading={isLoading}
            label="来月入金予定"
            value={yen(data?.nextMonthReceipts)}
          />
          <StatCard
            isLoading={isLoading}
            label="来月支払予定"
            value={yen(data?.nextMonthPayments)}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案件ID</TableHead>
              <TableHead>工事名</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead className="text-right">売上</TableHead>
              <TableHead className="text-right">原価</TableHead>
              <TableHead className="text-right">利益</TableHead>
              <TableHead className="text-right">利益率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i.toString()}`}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && (data?.projectProfit.length ?? 0) === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={7}
                >
                  当月稼働中の案件がありません
                </TableCell>
              </TableRow>
            )}
            {data?.projectProfit.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="tabular-nums">
                  {p.project_no ?? "-"}
                </TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.status || "-"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(p.revenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(p.cost)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(p.profit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {pct(p.margin)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {data && data.projectProfit.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium" colSpan={3}>
                  合計
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(data.totalRevenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(data.totalCost)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(data.totalProfit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {pct(data.avgMargin)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}

function GrowthChart({ points }: { points: Growth["points"] }) {
  const max = Math.max(
    1,
    ...points.map((p) => Math.abs(p.revenue)),
    ...points.map((p) => Math.abs(p.profit))
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-muted-foreground text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-secondary" />
          売上
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
          利益
        </span>
      </div>
      <div className="flex h-52 items-end gap-2 overflow-x-auto border-b pb-1">
        {points.map((p) => (
          <div
            className="flex h-full min-w-14 flex-1 flex-col items-center justify-end gap-1"
            key={p.ym}
          >
            <div className="flex h-full items-end gap-0.5">
              <div
                className="w-3 rounded-t-sm bg-secondary"
                style={{ height: `${(Math.abs(p.revenue) / max) * 100}%` }}
                title={`売上 ${yen(p.revenue)}`}
              />
              <div
                className={`w-3 rounded-t-sm ${p.profit < 0 ? "bg-destructive" : "bg-primary"}`}
                style={{ height: `${(Math.abs(p.profit) / max) * 100}%` }}
                title={`利益 ${yen(p.profit)}`}
              />
            </div>
            <span className="whitespace-nowrap text-muted-foreground text-xs">
              {p.ym}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrowthTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading } = api.dashboard.growth.useQuery({
    from: from || undefined,
    to: to || undefined,
  });

  const sortedPoints = useMemo(
    () => (data ? [...data.points].sort((a, b) => b.revenue - a.revenue) : []),
    [data]
  );
  const margin =
    data && data.totalRevenue > 0
      ? (data.totalProfit / data.totalRevenue) * 100
      : 0;

  const openPdf = () => {
    const f = from || data?.from || "";
    const t = to || data?.to || "";
    window.open(`/api/report/growth-pdf?from=${f}&to=${t}`, "_blank");
  };

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label>期間開始</Label>
          <Input
            className="w-40"
            onChange={(e) => setFrom(e.target.value)}
            placeholder={data?.from}
            type="month"
            value={from}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>期間終了</Label>
          <Input
            className="w-40"
            onChange={(e) => setTo(e.target.value)}
            placeholder={data?.to}
            type="month"
            value={to}
          />
        </div>
        <Button disabled={!data} onClick={openPdf} variant="outline">
          PDF出力
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal text-muted-foreground text-sm">
            月次推移（{data?.from ?? "-"} 〜 {data?.to ?? "-"}）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <GrowthChart points={data.points} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          isLoading={isLoading}
          label="期間売上合計"
          value={yen(data?.totalRevenue)}
        />
        <StatCard
          isLoading={isLoading}
          label="期間利益合計"
          value={yen(data?.totalProfit)}
        />
        <StatCard isLoading={isLoading} label="利益率" value={pct(margin)} />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>年月</TableHead>
              <TableHead className="text-right">売上</TableHead>
              <TableHead className="text-right">原価</TableHead>
              <TableHead className="text-right">利益</TableHead>
              <TableHead className="text-right">利益率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i.toString()}`}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && sortedPoints.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={5}
                >
                  対象期間のデータがありません
                </TableCell>
              </TableRow>
            )}
            {sortedPoints.map((p) => {
              const cost = p.revenue - p.profit;
              const m = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
              return (
                <TableRow key={p.ym}>
                  <TableCell className="tabular-nums">{p.ym}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {yen(p.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {yen(cost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {yen(p.profit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pct(m)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface VendorRow {
  amount: number;
  ratio: number;
  vendor: string;
}

function toDate(s: string | null | undefined): Date | null {
  if (!s) {
    return null;
  }
  const d = new Date(String(s).replaceAll("/", "-"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function VendorTab() {
  const { data: orders, isLoading } = api.orders.list.useQuery();
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const filtered = useMemo(() => {
    if (!orders) {
      return [];
    }
    const from = toDate(periodStart);
    const to = toDate(periodEnd);
    return orders.filter((o: Order) => {
      const d = toDate(o.periodStart);
      if (from && (!d || d < from)) {
        return false;
      }
      if (to && (!d || d > to)) {
        return false;
      }
      return true;
    });
  }, [orders, periodStart, periodEnd]);

  const vendorRows = useMemo<VendorRow[]>(() => {
    const sums = new Map<string, number>();
    let total = 0;
    for (const o of filtered) {
      const key = o.vendor || "（未設定）";
      const amount = Number(o.decided) || 0;
      sums.set(key, (sums.get(key) || 0) + amount);
      total += amount;
    }
    const rows = Array.from(sums.entries()).map(([vendor, amount]) => ({
      vendor,
      amount,
      ratio: total > 0 ? (amount / total) * 100 : 0,
    }));
    return rows.sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  const total = vendorRows.reduce((s, r) => s + r.amount, 0);
  const clear = () => {
    setPeriodStart("");
    setPeriodEnd("");
  };

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label>期間開始</Label>
          <Input
            className="w-40"
            onChange={(e) => setPeriodStart(e.target.value)}
            type="date"
            value={periodStart}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>期間終了</Label>
          <Input
            className="w-40"
            onChange={(e) => setPeriodEnd(e.target.value)}
            type="date"
            value={periodEnd}
          />
        </div>
        <Button onClick={clear} variant="outline">
          クリア
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>発注先</TableHead>
              <TableHead className="text-right">発注金額（決定額）</TableHead>
              <TableHead className="text-right">構成比</TableHead>
              <TableHead>備考</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i.toString()}`}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && vendorRows.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={4}
                >
                  対象期間の発注データがありません
                </TableCell>
              </TableRow>
            )}
            {vendorRows.map((r) => {
              const concentrated = r.ratio >= 30;
              return (
                <TableRow
                  className={concentrated ? "bg-destructive/10" : undefined}
                  key={r.vendor}
                >
                  <TableCell className="font-medium">{r.vendor}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {yen(r.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pct(r.ratio)}
                  </TableCell>
                  <TableCell>
                    {concentrated && (
                      <Badge variant="destructive">⚠️ 発注偏り</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {vendorRows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">合計</TableCell>
                <TableCell className="text-right tabular-nums">
                  {yen(total)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  100.0%
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
