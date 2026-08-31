import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "~/server/auth/jwt";

export const runtime = "nodejs";

export function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE_NAME);
  return res;
}
