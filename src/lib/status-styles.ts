/**
 * ステータス文字列 → 色クラスの対応表。旧app（status-utils.js の STATUS_MAP）を
 * 一次情報として、shadcnのセマンティックトークンでは表現できない
 * 成功(緑)/注意(黄)/危険(赤)の3色を、直接のTailwindユーティリティで再現する。
 * 4画面（受注一覧/工事計画/支払管理/売上・入金管理）が個別に色を持つと変更漏れの
 * 原因になるため、旧appと同じ思想でこの1ファイルに集約する。
 */

const NEUTRAL = "bg-muted text-muted-foreground";
const SUCCESS =
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
const WARNING =
  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
const DANGER = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
const INFO = "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";

// 受注一覧（projects.status）
export const PROJECT_STATUS_CLASS: Record<string, string> = {
  未対応: NEUTRAL,
  提案中: INFO,
  見積確認中: INFO,
  受注: SUCCESS,
  失注: DANGER,
  // 引渡月変更に伴う複製元（旧案件ID）。手動選択はさせず、複製処理からのみ付与される
  オーダー移行: NEUTRAL,
};

// 工事計画（orders.status）
export const ORDER_STATUS_CLASS: Record<string, string> = {
  未処理: NEUTRAL,
  見積待ち: WARNING,
  決定済み: INFO,
  発注完了: SUCCESS,
  支払済み: SUCCESS,
};

// 支払管理（orders.paymentStatus / misc_payments.status）
export const PAYMENT_STATUS_CLASS: Record<string, string> = {
  未払い: DANGER,
  部分払い: WARNING,
  支払済み: SUCCESS,
};

// 売上・入金管理（受注一覧のpayStatus相当 / misc_receipts.status）
export const RECEIPT_STATUS_CLASS: Record<string, string> = {
  入金済: SUCCESS,
  一部入金: WARNING,
  未入金: DANGER,
};

export function statusClass(
  map: Record<string, string>,
  status: string | null | undefined,
  fallback = NEUTRAL
): string {
  if (!status) {
    return fallback;
  }
  return map[status] ?? fallback;
}

/** 売上・入金管理の一覧行ハイライト（未入金/一部入金の行を薄い黄色で強調、旧app踏襲） */
export function receiptRowHighlightClass(
  payStatus: string | null | undefined
): string {
  return payStatus === "未入金" || payStatus === "一部入金"
    ? "bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
    : "";
}
