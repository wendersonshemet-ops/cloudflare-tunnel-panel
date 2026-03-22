import { NextRequest } from "next/server";
import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { validationError } from "@/lib/errors";
import { appendOperationLog } from "@/lib/operation-logs";
import { createService, listServices } from "@/lib/repository";
import { serviceSchema } from "@/lib/validation";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiAuth();
  if (auth) return auth;
  return ok({ items: listServices() });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    const parsed = serviceSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError("服务参数校验失败", parsed.error.flatten());
    }

    const item = createService(parsed.data);
    appendOperationLog({
      resourceType: "service",
      resourceId: item.id,
      action: "create",
      level: "info",
      message: `已创建服务 ${item.name}`,
      details: item,
    });
    return ok({ item }, { status: 201 });
  } catch (error) {
    appendOperationLog({
      resourceType: "service",
      action: "create",
      level: "error",
      message: error instanceof Error ? error.message : "创建服务失败",
    });
    return fail(fromUnknownError(error, "创建服务失败"), statusFromError(error, 400));
  }
}
