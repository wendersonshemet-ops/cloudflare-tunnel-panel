import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const password = String(body?.password || "");
  if (!verifyPassword(password)) {
    return fail({ message: "密码错误" }, 401);
  }
  await createSession();
  return ok({ authenticated: true });
}
