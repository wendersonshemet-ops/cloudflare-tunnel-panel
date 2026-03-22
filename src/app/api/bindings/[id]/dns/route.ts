import { NextRequest } from "next/server";
import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { requireApiAuth } from "@/lib/api-auth";
import { detachBindingDns, syncBindingDns } from "@/lib/orchestrator";
import { appendOperationLog } from "@/lib/operation-logs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (auth) return auth;

  const { id } = await context.params;

  try {
    const result = await syncBindingDns(id);
    appendOperationLog({
      resourceType: "dns",
      resourceId: id,
      action: "sync",
      level: "info",
      message: `DNS 已同步 ${id}`,
      details: result,
    });
    return ok(result);
  } catch (error) {
    appendOperationLog({
      resourceType: "dns",
      resourceId: id,
      action: "sync",
      level: "error",
      message: error instanceof Error ? error.message : "同步 DNS 记录失败",
    });
    return fail(fromUnknownError(error, "同步 DNS 记录失败"), statusFromError(error, 400));
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (auth) return auth;

  const { id } = await context.params;

  try {
    const result = await detachBindingDns(id);
    appendOperationLog({
      resourceType: "dns",
      resourceId: id,
      action: "detach",
      level: "warning",
      message: `DNS 已删除/解绑 ${id}`,
      details: result,
    });
    return ok(result);
  } catch (error) {
    appendOperationLog({
      resourceType: "dns",
      resourceId: id,
      action: "detach",
      level: "error",
      message: error instanceof Error ? error.message : "删除 DNS 记录失败",
    });
    return fail(fromUnknownError(error, "删除 DNS 记录失败"), statusFromError(error, 400));
  }
}
