import { listBindings } from "@/lib/repository";
import { Tunnel, TunnelSelectionStrategy } from "@/lib/types";

export function selectTunnelByStrategy(tunnels: Tunnel[], strategy: TunnelSelectionStrategy, zoneName: string): Tunnel | null {
  if (tunnels.length === 0) return null;

  if (strategy === "manual" || strategy === "first-available") {
    return tunnels[0] ?? null;
  }

  if (strategy === "zone-affinity") {
    const prefix = zoneName.split(".")[0]?.toLowerCase() || "";
    const matched = tunnels.find((item) => item.name.toLowerCase().includes(prefix));
    return matched ?? tunnels[0] ?? null;
  }

  const bindings = listBindings();
  const counts = new Map<string, number>();
  for (const binding of bindings) {
    counts.set(binding.tunnelId, (counts.get(binding.tunnelId) ?? 0) + 1);
  }

  return [...tunnels].sort((a, b) => {
    const scoreA = a.status === "online" ? 0 : a.status === "degraded" ? 1 : 2;
    const scoreB = b.status === "online" ? 0 : b.status === "degraded" ? 1 : 2;
    if (scoreA !== scoreB) return scoreA - scoreB;
    return (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0);
  })[0] ?? null;
}
