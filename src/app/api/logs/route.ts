import { ok } from "@/lib/api";
import { listOperationLogs } from "@/lib/operation-logs";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requireApiAuth();
  if (auth) return auth;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || "50");
  return ok({ items: listOperationLogs(Number.isFinite(limit) ? limit : 50) });
}