import { NextRequest } from "next/server";
import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { runBindingPreflight } from "@/lib/binding-preflight";
import { generateCloudflaredConfig, toYamlLike } from "@/lib/config-generator";
import { conflict } from "@/lib/errors";
import { publishBinding } from "@/lib/orchestrator";
import { listBindings } from "@/lib/repository";
import { listTunnelsState } from "@/lib/state";
import { bindingSchema } from "@/lib/validation";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiAuth();
  if (auth) return auth;
  const items = listBindings();
  const tunnels = await listTunnelsState();
  const preview = tunnels[0] ? toYamlLike(generateCloudflaredConfig(tunnels[0], items)) : "# 暂无 tunnel 可生成配置";

  return ok({
    items,
    generatedConfigPreview: preview,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (auth) return auth;
  const body = await request.json();
  const parsed = bindingSchema.safeParse(body);

  if (!parsed.success) {
    return fail({ message: "参数校验失败", code: "VALIDATION_ERROR", details: parsed.error.flatten() }, 400);
  }

  try {
    const preflight = await runBindingPreflight(parsed.data);
    if (!preflight.ok) {
      throw conflict("绑定预检未通过", preflight);
    }

    const payload = {
      ...parsed.data,
      tunnelId: parsed.data.tunnelId || preflight.chosenTunnel?.id || "",
      tunnelName: parsed.data.tunnelName || preflight.chosenTunnel?.name || "",
    };
    const result = await publishBinding(payload);
    return ok({ ...result, preflight }, { status: 201 });
  } catch (error) {
    return fail(fromUnknownError(error, "创建绑定失败"), statusFromError(error, 400));
  }
}
