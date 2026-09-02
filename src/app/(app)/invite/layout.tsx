import { redirect } from "next/navigation";
import { requireSession } from "~/server/auth/require-session";

const ALLOWED_ROLES = ["admin"];

/**
 * アカウント発行は管理者限定。
 * 旧app（public/invite.html）の Auth.redirectIfNotAllowedRole(['admin']) と同じ制御を、
 * サーバーコンポーネントのレイアウトで再現する。invite/page.tsx はクライアントツリーのため、
 * ここでガードすることでページ本体自体をマウントさせない。
 * フォールバック先は旧app（auth.js の redirectIfNotAllowedRole 既定値）と同じ /reporting。
 */
export default async function InviteLayout({
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
