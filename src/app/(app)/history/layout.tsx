import { redirect } from "next/navigation";
import { requireSession } from "~/server/auth/require-session";

const ALLOWED_ROLES = ["admin", "accounting"];

/**
 * 履歴閲覧は限定メンバー（管理者・経理部）のみ。
 * 旧app（public/history.html）の Auth.redirectIfNotAllowedRole(['admin', 'accounting']) と同じ制御を、
 * サーバーコンポーネントのレイアウトで再現する。history/page.tsx は "use client" のため、
 * ここでガードすることでページ本体自体をマウントさせない。
 * フォールバック先は旧app（auth.js の redirectIfNotAllowedRole 既定値）と同じ /reporting。
 */
export default async function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  if (!ALLOWED_ROLES.includes(user.role)) {
    redirect("/reporting");
  }
  return children;
}
