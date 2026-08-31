"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

const MIN_SIGNUP_PASSWORD_LENGTH = 8;

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "ログインに失敗しました");
        return;
      }
      router.push("/reporting");
      router.refresh();
    } catch {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (signupPassword.length < MIN_SIGNUP_PASSWORD_LENGTH) {
      setError("パスワードは8文字以上で設定してください");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "登録に失敗しました");
        return;
      }
      router.push("/reporting");
      router.refresh();
    } catch {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">construct-pro</CardTitle>
        </CardHeader>
        <CardContent>
          {view === "login" ? (
            <form className="flex flex-col gap-4" onSubmit={onLogin}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-email">メールアドレス</Label>
                <Input
                  id="login-email"
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  type="email"
                  value={loginEmail}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-pw">パスワード</Label>
                <Input
                  id="login-pw"
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  type="password"
                  value={loginPassword}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button disabled={loading} type="submit">
                ログイン
              </Button>
              <button
                className="text-muted-foreground text-sm hover:underline"
                onClick={() => {
                  setView("signup");
                  setError(null);
                }}
                type="button"
              >
                新規登録
              </button>
            </form>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={onSignup}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-name">お名前</Label>
                <Input
                  id="signup-name"
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="山田太郎"
                  required
                  value={signupName}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email">メールアドレス</Label>
                <Input
                  id="signup-email"
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                  type="email"
                  value={signupEmail}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-pw">パスワード（8文字以上）</Label>
                <Input
                  id="signup-pw"
                  minLength={MIN_SIGNUP_PASSWORD_LENGTH}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  type="password"
                  value={signupPassword}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button disabled={loading} type="submit">
                登録する
              </Button>
              <button
                className="text-muted-foreground text-sm hover:underline"
                onClick={() => {
                  setView("login");
                  setError(null);
                }}
                type="button"
              >
                ログイン
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
