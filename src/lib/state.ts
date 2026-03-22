import { CloudflareAdapter } from "@/lib/cloudflare-adapter";
import { CloudflaredAdapter } from "@/lib/cloudflared-adapter";
import { buildDnsDiffs } from "@/lib/dns-diff";
import {
  attachDnsRecordToBinding,
  clearBindingDnsRecord,
  getLastCloudflaredApply,
  getLastCloudflaredDeployment,
  getSyncStatus,
  listBindings,
  listDnsRecords,
  listServices,
  listStoredTunnels,
  listStoredZones,
  saveDnsRecords,
  saveTunnels,
  saveZones,
  updateSyncStatus,
} from "@/lib/repository";
import { DashboardSummary, DnsRecord, SyncStatus, Tunnel, Zone } from "@/lib/types";
import { inspectCloudflaredRuntimeConfig } from "@/lib/cloudflared-runtime-config";

const REMOTE_CONFIG_PATH = "remote-cloudflare";
const CACHE_TTL_MS = 15000;

function nowIso() {
  return new Date().toISOString();
}

function buildSyncStatus(input: Omit<SyncStatus, "resource">): SyncStatus {
  return {
    resource: "cloudflare",
    ...input,
  };
}

function pickTunnelStatus(status: string | undefined, connectorCount: number): Tunnel["status"] {
  if (connectorCount > 0) {
    return "online";
  }
  if (status === "inactive" || status === "down" || status === "offline") {
    return "offline";
  }
  return "degraded";
}

function computeZoneBoundCounts(bindings: ReturnType<typeof listBindings>) {
  const counts = new Map<string, number>();
  for (const binding of bindings) {
    counts.set(binding.zoneId, (counts.get(binding.zoneId) ?? 0) + 1);
  }
  return counts;
}

function reconcileBindingDns(bindings: ReturnType<typeof listBindings>, records: DnsRecord[]) {
  const recordByHostname = new Map(records.map((record) => [`${record.zoneId}:${record.hostname}`, record]));

  for (const binding of bindings) {
    const matched = recordByHostname.get(`${binding.zoneId}:${binding.hostname}`);
    if (matched) {
      attachDnsRecordToBinding(binding.id, {
        dnsStatus: matched.content === `${binding.tunnelId}.cfargotunnel.com` && matched.proxied ? "healthy" : "warning",
        recordId: matched.id,
        recordContent: matched.content,
      });
      continue;
    }

    clearBindingDnsRecord(binding.id, "warning");
  }
}

export async function syncCloudflareState(): Promise<SyncStatus> {
  const adapter = new CloudflareAdapter();
  if (!adapter.isConfigured()) {
    const previous = getSyncStatus("cloudflare");
    const status = buildSyncStatus({
      state: "warning",
      message: "Cloudflare API is not configured. Cached tunnel and DNS state will be used.",
      startedAt: null,
      finishedAt: nowIso(),
      lastSuccessAt: previous.lastSuccessAt,
      zoneCount: previous.zoneCount,
      tunnelCount: previous.tunnelCount,
      dnsRecordCount: previous.dnsRecordCount,
      errorDetail: null,
    });
    updateSyncStatus("cloudflare", status);
    return status;
  }

  const previous = getSyncStatus("cloudflare");
  const startedAt = nowIso();
  updateSyncStatus("cloudflare", buildSyncStatus({
    state: "idle",
    message: "Syncing Cloudflare zones, tunnels, and DNS records.",
    startedAt,
    finishedAt: null,
    lastSuccessAt: previous.lastSuccessAt,
    zoneCount: previous.zoneCount,
    tunnelCount: previous.tunnelCount,
    dnsRecordCount: previous.dnsRecordCount,
    errorDetail: null,
  }));

  try {
    const [zones, tunnels] = await Promise.all([adapter.listZones(), adapter.listTunnels()]);
    const dnsPerZone = await Promise.all(zones.map(async (zone) => ({
      zoneId: zone.id,
      records: await adapter.listDnsRecords(zone.id),
    })));
    const finishedAt = nowIso();
    const bindings = listBindings();
    const dnsRecords: DnsRecord[] = dnsPerZone.flatMap(({ zoneId, records }) =>
      records.map((record) => ({
        id: record.id,
        zoneId,
        bindingId: bindings.find((binding) => binding.zoneId === zoneId && binding.hostname === record.hostname)?.id ?? null,
        hostname: record.hostname,
        type: "CNAME",
        content: record.content,
        proxied: record.proxied,
        status: "healthy",
        source: "cloudflare",
        lastError: null,
        syncedAt: finishedAt,
      })),
    );

    saveZones(zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      status: zone.status === "active" ? "active" : zone.status === "pending" ? "pending" : "error",
      syncedAt: finishedAt,
    })));
    saveTunnels(tunnels.map((tunnel) => ({
      id: tunnel.id,
      name: tunnel.name,
      status: pickTunnelStatus(tunnel.status, tunnel.connectorCount),
      connectorCount: tunnel.connectorCount,
      syncedAt: finishedAt,
    })));
    saveDnsRecords(dnsRecords, zones.map((zone) => zone.id));
    reconcileBindingDns(bindings, dnsRecords);

    updateSyncStatus("cloudflare", buildSyncStatus({
      state: "healthy",
      message: `Synced ${zones.length} zone(s), ${tunnels.length} tunnel(s), and ${dnsRecords.length} DNS record(s).`,
      startedAt,
      finishedAt,
      lastSuccessAt: finishedAt,
      zoneCount: zones.length,
      tunnelCount: tunnels.length,
      dnsRecordCount: dnsRecords.length,
      errorDetail: null,
    }));
  } catch (error) {
    updateSyncStatus("cloudflare", buildSyncStatus({
      state: "error",
      message: error instanceof Error ? error.message : "Failed to sync Cloudflare state.",
      startedAt,
      finishedAt: nowIso(),
      lastSuccessAt: previous.lastSuccessAt,
      zoneCount: previous.zoneCount,
      tunnelCount: previous.tunnelCount,
      dnsRecordCount: previous.dnsRecordCount,
      errorDetail: error instanceof Error ? error.stack ?? error.message : "Failed to sync Cloudflare state.",
    }));
  }

  return getSyncStatus("cloudflare");
}

function deriveZonesFromBindings(): Zone[] {
  const bindings = listBindings();
  const counts = computeZoneBoundCounts(bindings);
  const byName = new Map<string, Zone>();

  for (const binding of bindings) {
    if (!binding.zoneName) continue;
    const existing = byName.get(binding.zoneName);
    byName.set(binding.zoneName, {
      id: (existing?.id ?? binding.zoneId) || `local_${binding.zoneName}`,
      name: binding.zoneName,
      status: "active",
      boundCount: (existing?.boundCount ?? 0) + 1,
      tunnelStatus: bindings.some((item) => item.zoneId === binding.zoneId && item.tunnelStatus !== "error") ? "online" : "degraded",
      syncedAt: nowIso(),
    });
  }

  return Array.from(byName.values()).map((zone) => ({
    ...zone,
    boundCount: counts.get(zone.id) ?? zone.boundCount,
  }));
}

export async function listZonesState(): Promise<Zone[]> {
  const bindings = listBindings();
  const counts = computeZoneBoundCounts(bindings);
  const stored = listStoredZones();

  if (stored.length > 0) {
    return stored.map((zone) => ({
      ...zone,
      boundCount: counts.get(zone.id) ?? 0,
      tunnelStatus: bindings.some((binding) => binding.zoneId === zone.id && binding.tunnelStatus !== "error") ? "online" : "degraded",
    }));
  }

  return deriveZonesFromBindings();
}

export async function listTunnelsState(): Promise<Tunnel[]> {
  const stored = listStoredTunnels(REMOTE_CONFIG_PATH);
  const bindings = listBindings();

  if (stored.length > 0) {
    return stored.map((tunnel) => ({
      ...tunnel,
      configPath: REMOTE_CONFIG_PATH,
      status: tunnel.connectorCount > 0 ? "online" : tunnel.status === "offline" ? "offline" : "degraded",
    }));
  }

  const byId = new Map<string, Tunnel>();
  for (const binding of bindings) {
    if (!binding.tunnelId) continue;
    const existing = byId.get(binding.tunnelId);
    byId.set(binding.tunnelId, {
      id: binding.tunnelId,
      name: binding.tunnelName || existing?.name || binding.tunnelId,
      status: "degraded",
      connectorCount: existing?.connectorCount ?? 0,
      configPath: REMOTE_CONFIG_PATH,
      syncedAt: nowIso(),
    });
  }

  return Array.from(byId.values());
}

export async function getDashboardState(): Promise<{
  summary: DashboardSummary;
  zones: Zone[];
  tunnels: Tunnel[];
  dnsRecords: DnsRecord[];
  dnsDiffs: ReturnType<typeof buildDnsDiffs>;
  syncStatus: SyncStatus;
  cloudflared: {
    info: Awaited<ReturnType<CloudflaredAdapter["getInfo"]>>;
    lastApply: ReturnType<typeof getLastCloudflaredApply>;
    lastDeployment: ReturnType<typeof getLastCloudflaredDeployment>;
    status: ReturnType<typeof getLastCloudflaredDeployment> extends infer T ? T extends { status: infer S } ? S : null : null;
    runtimeConfig: Awaited<ReturnType<typeof inspectCloudflaredRuntimeConfig>>;
  };
}> {
  const [zones, tunnels] = await Promise.all([listZonesState(), listTunnelsState()]);
  const bindings = listBindings();
  const services = listServices();
  const cloudflared = new CloudflaredAdapter();
  const info = await cloudflared.getInfo();
  const syncStatus = getSyncStatus("cloudflare");
  const lastApply = getLastCloudflaredApply();
  const lastDeployment = getLastCloudflaredDeployment();
  const runtimeConfig = await inspectCloudflaredRuntimeConfig();
  const incidentCount = bindings.filter(
    (item) =>
      item.accessStatus !== "healthy" ||
      item.localStatus !== "healthy" ||
      item.tunnelStatus !== "healthy" ||
      item.dnsStatus !== "healthy",
  ).length;

  const dnsRecords = listDnsRecords();
  const dnsDiffs = buildDnsDiffs(bindings, dnsRecords);

  return {
    summary: {
      zoneCount: zones.length,
      serviceCount: services.length,
      bindingCount: bindings.length,
      incidentCount,
      tunnelOnlineCount: tunnels.filter((tunnel) => tunnel.status === "online").length,
      tunnelTotalCount: tunnels.length,
    },
    zones,
    tunnels,
    dnsRecords,
    dnsDiffs,
    syncStatus,
    cloudflared: {
      info,
      lastApply,
      lastDeployment,
      status: lastDeployment?.status ?? null,
      runtimeConfig,
    },
  };
}

let cachedTunnels: { data: Tunnel[]; expires: number } | null = null;

export async function listTunnelsStateCached(): Promise<Tunnel[]> {
  if (cachedTunnels && Date.now() < cachedTunnels.expires) {
    return cachedTunnels.data;
  }
  const data = await listTunnelsState();
  cachedTunnels = { data, expires: Date.now() + CACHE_TTL_MS };
  return data;
}
