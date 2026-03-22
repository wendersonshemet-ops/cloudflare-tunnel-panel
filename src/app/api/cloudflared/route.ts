import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { requireApiAuth } from "@/lib/api-auth";
import { applyPrimaryTunnelConfig } from "@/lib/orchestrator";
import { appendOperationLog } from "@/lib/operation-logs";
import { getDashboardState } from "@/lib/state";

export const dynamic = "force-dynamic";

function summarizeConnectorStatus(total: number, online: number, tunnelCount: number) {
  if (tunnelCount === 0) return "unknown";
  if (online === tunnelCount) return "online";
  if (online === 0 && total === 0) return "degraded";
  return "degraded";
}

export async function GET() {
  const auth = await requireApiAuth();
  if (auth) return auth;

  const dashboard = await getDashboardState();
  const connectorCount = dashboard.tunnels.reduce((sum, tunnel) => sum + tunnel.connectorCount, 0);
  const onlineTunnelCount = dashboard.tunnels.filter((tunnel) => tunnel.status === "online").length;

  return ok({
    ...dashboard.cloudflared.info,
    tunnels: dashboard.tunnels,
    connectorCount,
    connectorStatus: summarizeConnectorStatus(connectorCount, onlineTunnelCount, dashboard.tunnels.length),
    lastApply: dashboard.cloudflared.lastApply,
    lastDeployment: dashboard.cloudflared.lastDeployment,
    status: dashboard.cloudflared.status,
    runtimeConfig: dashboard.cloudflared.runtimeConfig,
  });
}

export async function POST() {
  const auth = await requireApiAuth();
  if (auth) return auth;

  try {
    const { tunnel, deployment } = await applyPrimaryTunnelConfig();
    appendOperationLog({
      resourceType: "cloudflared",
      resourceId: tunnel.id,
      action: "remote-publish:manual",
      level: deployment.status.level === "error" ? "error" : deployment.status.level === "warning" ? "warning" : "info",
      message: deployment.status.summary,
      details: deployment.status,
    });
    return ok({
      tunnel,
      deployment,
      status: deployment.status,
    });
  } catch (error) {
    appendOperationLog({
      resourceType: "cloudflared",
      action: "remote-publish:manual",
      level: "error",
      message: error instanceof Error ? error.message : "Failed to publish remote tunnel ingress.",
    });
    return fail(fromUnknownError(error, "Failed to publish remote tunnel ingress."), statusFromError(error, 400));
  }
}
