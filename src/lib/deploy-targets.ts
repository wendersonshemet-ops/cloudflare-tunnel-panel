import { getSettings } from "@/lib/settings";

export function getDeploymentTargets() {
  const settings = getSettings();

  return {
    runtimeMode: "remote-docker-only",
    ctpRuntime: "docker compose -f docker-compose.prod.yml build ctp",
    connectorRuntime: "externally managed Docker container",
    networkMode: "host",
    connectorCommand: "cloudflared tunnel --no-autoupdate run",
    connectorTokenEnv: "TUNNEL_TOKEN",
    controlPlane: "Cloudflare API for DNS and tunnel ingress",
    lifecycleControl: "CTP observes connector status but does not start or stop cloudflared",
    healthTimeoutMs: Number(settings.healthTimeoutMs || "3000"),
    tunnelSelectionStrategy: settings.tunnelSelectionStrategy,
  };
}
