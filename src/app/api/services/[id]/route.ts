import { NextRequest } from "next/server";
import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { requireApiAuth } from "@/lib/api-auth";
import { appendOperationLog } from "@/lib/operation-logs";
import { deleteService, getService, updateService } from "@/lib/repository";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  scheme: z.enum(["http", "https"]).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  healthCheckPath: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (auth) return auth;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ message: "参数校验失败" }, 400);
    }
    const item = updateService(id, parsed.data);
    if (!item) return fail({ message: "服务不存在" }, 404);
    appendOperationLog({
      resourceType: "service",
      resourceId: id,
      action: "update",
      level: "info",
      message: `已更新服务 ${item.name}`,
      details: item,
    });
    return ok({ item });
  } catch (error) {
    appendOperationLog({ resourceType: "service", action: "update", level: "error", message: String(error) });
    return fail(fromUnknownError(error), statusFromError(error));
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (auth) return auth;
  try {
    const { id } = await context.params;
    const item = getService(id);
    if (!item) return fail({ message: "服务不存在" }, 404);
    deleteService(id);
    appendOperationLog({
      resourceType: "service",
      resourceId: id,
      action: "delete",
      level: "info",
      message: `已删除服务 ${item.name}`,
    });
    return ok({ id });
  } catch (error) {
    return fail(fromUnknownError(error), statusFromError(error));
  }
}
