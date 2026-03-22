import { listBindings, listServices } from "@/lib/repository";
import { getSettings } from "@/lib/settings";
import { listTunnelsStateCached } from "@/lib/state";
import { selectTunnelByStrategy } from "@/lib/tunnel-selection";
import { BindingPreflightResult } from "@/lib/types";

export async function runBindingPreflight(input: {
  hostname: string;
  serviceId: string;
  zoneId: string;
  zoneName: string;
  tunnelId?: string;
}) : Promise<BindingPreflightResult> {
  const settings = getSettings();
  const bindings = listBindings();
  const services = listServices();
  const tunnels = await listTunnelsStateCached();
  const conflicts: string[] = [];
  const warnings: string[] = [];

  const existingByHostname = bindings.find((item) => item.hostname === input.hostname) ?? null;
  if (existingByHostname) {
    conflicts.push(`hostname 已被绑定：${input.hostname}`);
  }

  const service = services.find((item) => item.id === input.serviceId) ?? null;
  if (!service) {
    conflicts.push("目标服务不存在");
  } else {
    if (service.boundHostname && service.boundHostname !== input.hostname) {
      conflicts.push(`服务已绑定到 ${service.boundHostname}`);
    }
    if (!service.healthy) {
      warnings.push("目标服务当前健康检查未通过");
    }
  }

  const strategy = input.tunnelId ? "manual" : settings.tunnelSelectionStrategy;
  const chosenTunnel = input.tunnelId
    ? tunnels.find((item) => item.id === input.tunnelId) ?? null
    : selectTunnelByStrategy(tunnels, strategy, input.zoneName);

  if (!chosenTunnel) {
    conflicts.push("没有可用 tunnel");
  } else if (chosenTunnel.status !== "online") {
    warnings.push(`选中的 tunnel 当前状态为 ${chosenTunnel.status}`);
  }

  if (!input.hostname.endsWith(`.${input.zoneName}`) && input.hostname !== input.zoneName) {
    warnings.push("hostname 与 zoneName 看起来不匹配，请再次确认");
  }

  return {
    ok: conflicts.length === 0,
    hostnameAvailable: !existingByHostname,
    existingBindingId: existingByHostname?.id ?? null,
    chosenTunnel,
    strategy,
    conflicts,
    warnings,
  };
}
