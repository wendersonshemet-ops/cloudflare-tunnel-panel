import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { CloudflareAdapter } from "@/lib/cloudflare-adapter";
import { appendOperationLog } from "@/lib/operation-logs";
import { getSyncStatus } from "@/lib/repository";
import { listTunnelsState, listZonesState, syncCloudflareState, getDashboardState } from "@/lib/state";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAuth();
  if (auth) return auth;
  const adapter = new CloudflareAdapter();
  const shouldRefresh = new URL(request.url).searchParams.get("refresh") === "1";

  if (!adapter.isConfigured()) {
    return ok({
      configured: false,
      zones: [],
      tunnels: [],
      dnsRecords: [],
      syncStatus: getSyncStatus("cloudflare"),
    });
  }

  try {
    const syncStatus = shouldRefresh ? await syncCloudflareState() : getSyncStatus("cloudflare");
    const [{ dnsRecords, dnsDiffs }, zones, tunnels] = await Promise.all([
      getDashboardState(),
      listZonesState(),
      listTunnelsState(),
    ]);

    appendOperationLog({
      resourceType: "integration",
      action: shouldRefresh ? "refresh" : "query",
      level: "info",
      message: shouldRefresh ? "已刷新 Cloudflare 集成状态" : "已读取 Cloudflare 集成状态",
      details: { zones: zones.length, tunnels: tunnels.length, dnsRecords: dnsRecords.length },
    });

    return ok({
      configured: true,
      zones,
      tunnels,
      dnsRecords,
      dnsDiffs,
      syncStatus,
    });
  } catch (error) {
    appendOperationLog({
      resourceType: "integration",
      action: shouldRefresh ? "refresh" : "query",
      level: "error",
      message: error instanceof Error ? error.message : "集成查询失败",
    });
    return fail({
      ...fromUnknownError(error, "集成查询失败"),
      details: {
        configured: true,
        syncStatus: getSyncStatus("cloudflare"),
      },
    }, statusFromError(error, 500));
  }
}
