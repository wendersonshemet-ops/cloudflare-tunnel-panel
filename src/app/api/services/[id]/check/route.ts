import { NextRequest } from "next/server";
import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { requireApiAuth } from "@/lib/api-auth";
import { checkService } from "@/lib/health";
import { appendOperationLog } from "@/lib/operation-logs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (auth) return auth;

  const { id } = await context.params;

  try {
    const result = await checkService(id);
    appendOperationLog({
      resourceType: "service",
      resourceId: id,
      action: "check",
      level: result.healthy ? "info" : "warning",
      message: `服务检查完成 ${result.url}`,
      details: result,
    });
    return ok(result);
  } catch (error) {
    appendOperationLog({
      resourceType: "service",
      resourceId: id,
      action: "check",
      level: "error",
      message: error instanceof Error ? error.message : "检查失败",
    });
    return fail(fromUnknownError(error, "检查失败"), statusFromError(error, 400));
  }
}
