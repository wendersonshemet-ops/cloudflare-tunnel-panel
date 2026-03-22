import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { appendOperationLog } from "@/lib/operation-logs";
import { getDashboardState } from "@/lib/state";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireApiAuth();
  if (auth) return auth;
  try {
    const state = await getDashboardState();
    return ok(state);
  } catch (error) {
    appendOperationLog({
      resourceType: "dashboard",
      action: "query",
      level: "error",
      message: error instanceof Error ? error.message : "读取总览失败",
    });
    return fail(fromUnknownError(error, "读取总览失败"), statusFromError(error, 500));
  }
}