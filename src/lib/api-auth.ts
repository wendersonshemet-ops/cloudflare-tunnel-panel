import { fail } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export async function requireApiAuth() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return fail({ message: "未登录或会话已失效", code: "UNAUTHORIZED" }, 401);
  }
  return null;
}
