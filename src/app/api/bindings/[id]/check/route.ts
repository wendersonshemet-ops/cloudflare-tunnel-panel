import { NextRequest } from "next/server";
import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { requireApiAuth } from "@/lib/api-auth";
import { checkBinding } from "@/lib/health";
import { appendOperationLog } from "@/lib/operation-logs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (auth) return auth;

  const { id } = await context.params;

  try {
    const result = await checkBinding(id);
    appendOperationLog({
      resourceType: "binding",
      resourceId: id,
      action: "check",
      level: result.accessStatus === "healthy" ? "info" : "warning",
      message: `绑定检查完成 ${result.hostname}`,
      details: result,
    });
    return ok(result);
  } catch (error) {
    appendOperationLog({
      resourceType: "binding",
      resourceId: id,
      action: "check",
      level: "error",
      message: error instanceof Error ? error.message : "检查失败",
    });
    return fail(fromUnknownError(error, "检查失败"), statusFromError(error, 400));
  }
}
