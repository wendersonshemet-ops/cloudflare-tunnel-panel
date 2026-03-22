import { NextRequest } from "next/server";
import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { runBindingPreflight } from "@/lib/binding-preflight";
import { validationError } from "@/lib/errors";
import { requireApiAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    if (!body?.hostname || !body?.serviceId || !body?.zoneId || !body?.zoneName) {
      throw validationError("预检参数不完整", body);
    }

    const result = await runBindingPreflight({
      hostname: String(body.hostname),
      serviceId: String(body.serviceId),
      zoneId: String(body.zoneId),
      zoneName: String(body.zoneName),
      tunnelId: body.tunnelId ? String(body.tunnelId) : undefined,
    });

    return ok(result);
  } catch (error) {
    return fail(fromUnknownError(error, "预检失败"), statusFromError(error, 400));
  }
}