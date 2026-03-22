import { NextRequest } from "next/server";
import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { requireApiAuth } from "@/lib/api-auth";
import { runBindingPreflight } from "@/lib/binding-preflight";
import { conflict } from "@/lib/errors";
import { appendOperationLog } from "@/lib/operation-logs";
import { unpublishBinding, updatePublishedBinding } from "@/lib/orchestrator";
import { getBinding } from "@/lib/repository";
import { bindingSchema } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (auth) return auth;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = bindingSchema.safeParse(body);

  if (!parsed.success) {
    return fail({ message: "参数校验失败", code: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);
  }

  try {
    const current = getBinding(id);
    if (!current) {
      throw conflict("绑定不存在", { id });
    }

    const preflight = await runBindingPreflight(parsed.data);
    const onlySelfConflict = preflight.existingBindingId && preflight.existingBindingId === id;
    if (!preflight.ok && !onlySelfConflict) {
      throw conflict("绑定预检未通过", preflight);
    }

    const result = await updatePublishedBinding(id, parsed.data);
    appendOperationLog({
      resourceType: "binding",
      resourceId: id,
      action: "update",
      level: "info",
      message: `绑定已更新 ${current.hostname} -> ${parsed.data.hostname}`,
      details: { preflight },
    });
    return ok({ ...result, preflight });
  } catch (error) {
    appendOperationLog({
      resourceType: "binding",
      resourceId: id,
      action: "update",
      level: "error",
      message: error instanceof Error ? error.message : "修改失败",
    });
    return fail(fromUnknownError(error, "修改失败"), statusFromError(error, 400));
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
    const result = await unpublishBinding(id);
    return ok(result);
  } catch (error) {
    appendOperationLog({
      resourceType: "binding",
      resourceId: id,
      action: "delete",
      level: "error",
      message: error instanceof Error ? error.message : "删除失败",
    });
    return fail(fromUnknownError(error, "删除失败"), statusFromError(error, 400));
  }
}
