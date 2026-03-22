import { randomUUID } from "node:crypto";
import { normalizeApplyResult, normalizeDeploymentResult } from "@/lib/cloudflared-status";
import { getDb } from "@/lib/db";
import {
  Binding,
  CloudflaredApplyResult,
  CloudflaredDeploymentResult,
  DnsRecord,
  LocalService,
  SyncStatus,
  Tunnel,
  Zone,
} from "@/lib/types";

function now() {
  return new Date().toISOString();
}

function mapBinding(row: Record<string, unknown>): Binding {
  return {
    id: String(row.id),
    zoneId: String(row.zone_id),
    zoneName: String(row.zone_name),
    hostname: String(row.hostname),
    serviceId: String(row.service_id),
    serviceName: String(row.service_name),
    serviceTarget: String(row.service_target),
    tunnelId: String(row.tunnel_id),
    tunnelName: String(row.tunnel_name),
    dnsStatus: row.dns_status as Binding["dnsStatus"],
    dnsRecordId: row.dns_record_id ? String(row.dns_record_id) : null,
    dnsRecordContent: row.dns_record_content ? String(row.dns_record_content) : null,
    tunnelStatus: row.tunnel_status as Binding["tunnelStatus"],
    accessStatus: row.access_status as Binding["accessStatus"],
    localStatus: row.local_status as Binding["localStatus"],
    checkedAt: String(row.checked_at),
    updatedAt: String(row.updated_at),
  };
}

function ensureBaseRows() {
  const db = getDb();
  const syncCount = db.prepare("SELECT COUNT(*) AS count FROM sync_status").get() as { count: number };

  if (syncCount.count === 0) {
    db.prepare(`
      INSERT INTO sync_status (resource, state, message, started_at, finished_at)
      VALUES (?, ?, ?, ?, ?)
    `).run("cloudflare", "idle", "尚未同步 Cloudflare 资源", null, null);
  }
}

export function listServices(): LocalService[] {
  ensureBaseRows();
  const db = getDb();
  const rows = db.prepare("SELECT * FROM services ORDER BY updated_at DESC").all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    scheme: row.scheme as "http" | "https",
    host: String(row.host),
    port: Number(row.port),
    healthCheckPath: String(row.health_check_path),
    source: row.source as LocalService["source"],
    healthy: Number(row.healthy) === 1,
    statusCode: row.status_code === null ? null : Number(row.status_code),
    boundHostname: row.bound_hostname ? String(row.bound_hostname) : null,
    updatedAt: String(row.updated_at),
  }));
}

export function getService(id: string): LocalService | undefined {
  ensureBaseRows();
  const db = getDb();
  const row = db.prepare("SELECT * FROM services WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return {
    id: String(row.id),
    name: String(row.name),
    scheme: row.scheme as "http" | "https",
    host: String(row.host),
    port: Number(row.port),
    healthCheckPath: String(row.health_check_path),
    source: row.source as LocalService["source"],
    healthy: Number(row.healthy) === 1,
    statusCode: row.status_code === null ? null : Number(row.status_code),
    boundHostname: row.bound_hostname ? String(row.bound_hostname) : null,
    updatedAt: String(row.updated_at),
  };
}


export function createService(input: Omit<LocalService, "id" | "healthy" | "statusCode" | "boundHostname" | "updatedAt">) {
  ensureBaseRows();
  const db = getDb();

  const conflict = db.prepare(`SELECT id FROM services WHERE name = ? AND host = ? AND port = ?`).get(
    input.name,
    input.host,
    input.port,
  ) as { id: string } | undefined;
  if (conflict) {
    throw new Error(`服务已存在：${input.name} (${input.host}:${input.port})`);
  }

  const item: LocalService = {
    id: randomUUID(),
    healthy: true,
    statusCode: 200,
    boundHostname: null,
    updatedAt: now(),
    ...input,
  };

  db.prepare(`
    INSERT INTO services (
      id, name, scheme, host, port, health_check_path, source, healthy, status_code, bound_hostname, updated_at
    ) VALUES (
      @id, @name, @scheme, @host, @port, @healthCheckPath, @source, @healthy, @statusCode, @boundHostname, @updatedAt
    )
  `).run({
    ...item,
    healthy: item.healthy ? 1 : 0,
  });

  return item;
}

export function updateServiceHealth(serviceId: string, data: { healthy: boolean; statusCode: number | null }) {
  ensureBaseRows();
  const db = getDb();
  const timestamp = now();
  db.prepare(`UPDATE services SET healthy = ?, status_code = ?, updated_at = ? WHERE id = ?`).run(
    data.healthy ? 1 : 0,
    data.statusCode,
    timestamp,
    serviceId,
  );

  const bound = db.prepare(`SELECT bound_hostname FROM services WHERE id = ?`).get(serviceId) as { bound_hostname?: string } | undefined;
  const hostname = bound?.bound_hostname;
  if (hostname) {
    db.prepare(`UPDATE bindings SET local_status = ?, checked_at = ?, updated_at = ? WHERE hostname = ?`).run(
      data.healthy ? "healthy" : "error",
      timestamp,
      timestamp,
      hostname,
    );
  }
}

export function listBindings(): Binding[] {
  ensureBaseRows();
  const db = getDb();
  const rows = db.prepare("SELECT * FROM bindings ORDER BY updated_at DESC").all() as Array<Record<string, unknown>>;
  return rows.map(mapBinding);
}

export function getBinding(bindingId: string) {
  ensureBaseRows();
  const db = getDb();
  const row = db.prepare("SELECT * FROM bindings WHERE id = ?").get(bindingId) as Record<string, unknown> | undefined;
  return row ? mapBinding(row) : null;
}

export function createBinding(input: {
  zoneId: string;
  zoneName: string;
  hostname: string;
  serviceId: string;
  tunnelId: string;
  tunnelName: string;
}) {
  ensureBaseRows();
  const db = getDb();
  const service = listServices().find((item) => item.id === input.serviceId);

  if (!service) {
    throw new Error("目标服务不存在");
  }

  const hostnameConflict = db.prepare(`SELECT id FROM bindings WHERE hostname = ?`).get(input.hostname) as { id: string } | undefined;
  if (hostnameConflict) {
    throw new Error("该子域名已经存在绑定");
  }

  if (service.boundHostname) {
    throw new Error(`该服务已绑定到 ${service.boundHostname}`);
  }

  const timestamp = now();
  const binding: Binding = {
    id: randomUUID(),
    zoneId: input.zoneId,
    zoneName: input.zoneName,
    hostname: input.hostname,
    serviceId: service.id,
    serviceName: service.name,
    serviceTarget: `${service.scheme}://${service.host}:${service.port}`,
    tunnelId: input.tunnelId,
    tunnelName: input.tunnelName,
    dnsStatus: "warning",
    dnsRecordId: null,
    dnsRecordContent: null,
    tunnelStatus: "warning",
    accessStatus: "unknown",
    localStatus: service.healthy ? "healthy" : "error",
    checkedAt: timestamp,
    updatedAt: timestamp,
  };

  db.prepare(`
    INSERT INTO bindings (
      id, zone_id, zone_name, hostname, service_id, service_name, service_target,
      tunnel_id, tunnel_name, dns_status, dns_record_id, dns_record_content,
      tunnel_status, access_status, local_status, checked_at, updated_at
    ) VALUES (
      @id, @zoneId, @zoneName, @hostname, @serviceId, @serviceName, @serviceTarget,
      @tunnelId, @tunnelName, @dnsStatus, @dnsRecordId, @dnsRecordContent,
      @tunnelStatus, @accessStatus, @localStatus, @checkedAt, @updatedAt
    )
  `).run(binding);

  db.prepare(`UPDATE services SET bound_hostname = ?, updated_at = ? WHERE id = ?`).run(
    binding.hostname,
    timestamp,
    service.id,
  );

  return binding;
}

export function updateBinding(bindingId: string, input: {
  zoneId: string;
  zoneName: string;
  hostname: string;
  serviceId: string;
  tunnelId: string;
  tunnelName: string;
}) {
  ensureBaseRows();
  const db = getDb();
  const current = db.prepare(`SELECT * FROM bindings WHERE id = ?`).get(bindingId) as Record<string, unknown> | undefined;

  if (!current) {
    throw new Error("绑定不存在");
  }

  const service = listServices().find((item) => item.id === input.serviceId);
  if (!service) {
    throw new Error("目标服务不存在");
  }

  const conflict = db.prepare(`SELECT id FROM bindings WHERE hostname = ? AND id != ?`).get(input.hostname, bindingId) as { id: string } | undefined;
  if (conflict) {
    throw new Error("该子域名已经存在绑定");
  }

  const oldServiceId = String(current.service_id);
  const oldHostname = String(current.hostname);
  if (service.boundHostname && service.boundHostname !== oldHostname) {
    throw new Error(`该服务已绑定到 ${service.boundHostname}`);
  }

  const timestamp = now();
  db.prepare(`
    UPDATE bindings
    SET zone_id = ?, zone_name = ?, hostname = ?,
        service_id = ?, service_name = ?, service_target = ?,
        tunnel_id = ?, tunnel_name = ?,
        dns_status = ?, dns_record_id = ?, dns_record_content = ?,
        tunnel_status = ?, access_status = ?, local_status = ?,
        checked_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.zoneId,
    input.zoneName,
    input.hostname,
    service.id,
    service.name,
    `${service.scheme}://${service.host}:${service.port}`,
    input.tunnelId,
    input.tunnelName,
    oldHostname === input.hostname ? current.dns_status : "warning",
    oldHostname === input.hostname ? current.dns_record_id : null,
    oldHostname === input.hostname ? current.dns_record_content : null,
    String(current.tunnel_id) === input.tunnelId ? current.tunnel_status : "warning",
    "unknown",
    service.healthy ? "healthy" : "error",
    timestamp,
    timestamp,
    bindingId,
  );

  if (oldServiceId !== service.id) {
    db.prepare(`UPDATE services SET bound_hostname = NULL, updated_at = ? WHERE id = ?`).run(timestamp, oldServiceId);
  }
  db.prepare(`UPDATE services SET bound_hostname = ?, updated_at = ? WHERE id = ?`).run(input.hostname, timestamp, service.id);
  db.prepare(`UPDATE dns_records SET binding_id = NULL, synced_at = ? WHERE binding_id = ? AND hostname != ?`).run(timestamp, bindingId, input.hostname);

  return getBinding(bindingId);
}

export function deleteBinding(bindingId: string) {
  ensureBaseRows();
  const db = getDb();
  const binding = db.prepare(`SELECT * FROM bindings WHERE id = ?`).get(bindingId) as Record<string, unknown> | undefined;

  if (!binding) {
    throw new Error("绑定不存在");
  }

  const timestamp = now();
  db.prepare(`DELETE FROM bindings WHERE id = ?`).run(bindingId);
  db.prepare(`UPDATE services SET bound_hostname = NULL, updated_at = ? WHERE id = ?`).run(
    timestamp,
    String(binding.service_id),
  );
  db.prepare(`UPDATE dns_records SET binding_id = NULL, synced_at = ? WHERE binding_id = ?`).run(timestamp, bindingId);

  return { success: true, hostname: String(binding.hostname), zoneId: String(binding.zone_id) };
}

export function setBindingStatuses(
  bindingId: string,
  data: {
    localStatus: Binding["localStatus"];
    accessStatus: Binding["accessStatus"];
    dnsStatus?: Binding["dnsStatus"];
    tunnelStatus?: Binding["tunnelStatus"];
  },
) {
  ensureBaseRows();
  const db = getDb();
  const current = db.prepare(`SELECT dns_status, tunnel_status FROM bindings WHERE id = ?`).get(bindingId) as
    | { dns_status: Binding["dnsStatus"]; tunnel_status: Binding["tunnelStatus"] }
    | undefined;

  if (!current) {
    throw new Error("绑定不存在");
  }

  const timestamp = now();
  db.prepare(`
    UPDATE bindings
    SET local_status = ?, access_status = ?, dns_status = ?, tunnel_status = ?, checked_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    data.localStatus,
    data.accessStatus,
    data.dnsStatus ?? current.dns_status,
    data.tunnelStatus ?? current.tunnel_status,
    timestamp,
    timestamp,
    bindingId,
  );
}

export function attachDnsRecordToBinding(
  bindingId: string,
  data: { dnsStatus: Binding["dnsStatus"]; recordId: string | null; recordContent: string | null },
) {
  ensureBaseRows();
  const db = getDb();
  const timestamp = now();
  db.prepare(`
    UPDATE bindings
    SET dns_status = ?, dns_record_id = ?, dns_record_content = ?, checked_at = ?, updated_at = ?
    WHERE id = ?
  `).run(data.dnsStatus, data.recordId, data.recordContent, timestamp, timestamp, bindingId);
}

export function clearBindingDnsRecord(bindingId: string, dnsStatus: Binding["dnsStatus"] = "warning") {
  attachDnsRecordToBinding(bindingId, {
    dnsStatus,
    recordId: null,
    recordContent: null,
  });
}

export function listStoredZones(): Zone[] {
  ensureBaseRows();
  const rows = getDb().prepare("SELECT * FROM cloudflare_zones ORDER BY name ASC").all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: row.status as Zone["status"],
    boundCount: 0,
    tunnelStatus: "degraded",
    syncedAt: String(row.synced_at),
  }));
}

export function saveZones(zones: Array<Pick<Zone, "id" | "name" | "status" | "syncedAt">>) {
  ensureBaseRows();
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO cloudflare_zones (id, name, status, synced_at)
    VALUES (@id, @name, @status, @syncedAt)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      status = excluded.status,
      synced_at = excluded.synced_at
  `);
  const removeMissing = db.prepare(`
    DELETE FROM cloudflare_zones
    WHERE id NOT IN (${zones.map(() => "?").join(",")})
  `);

  const tx = db.transaction(() => {
    for (const zone of zones) {
      upsert.run(zone);
    }
    if (zones.length > 0) {
      removeMissing.run(...zones.map((zone) => zone.id));
    } else {
      db.prepare("DELETE FROM cloudflare_zones").run();
    }
  });
  tx();
}

export function listStoredTunnels(configPath = "remote-cloudflare"): Tunnel[] {
  ensureBaseRows();
  const rows = getDb().prepare("SELECT * FROM cloudflare_tunnels ORDER BY name ASC").all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: row.status as Tunnel["status"],
    connectorCount: Number(row.connector_count),
    configPath,
    syncedAt: String(row.synced_at),
  }));
}

export function saveTunnels(tunnels: Array<Pick<Tunnel, "id" | "name" | "status" | "connectorCount" | "syncedAt">>) {
  ensureBaseRows();
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO cloudflare_tunnels (id, name, status, connector_count, synced_at)
    VALUES (@id, @name, @status, @connectorCount, @syncedAt)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      status = excluded.status,
      connector_count = excluded.connector_count,
      synced_at = excluded.synced_at
  `);
  const removeMissing = db.prepare(`
    DELETE FROM cloudflare_tunnels
    WHERE id NOT IN (${tunnels.map(() => "?").join(",")})
  `);

  const tx = db.transaction(() => {
    for (const tunnel of tunnels) {
      upsert.run(tunnel);
    }
    if (tunnels.length > 0) {
      removeMissing.run(...tunnels.map((tunnel) => tunnel.id));
    } else {
      db.prepare("DELETE FROM cloudflare_tunnels").run();
    }
  });
  tx();
}

export function listDnsRecords(): DnsRecord[] {
  ensureBaseRows();
  const rows = getDb().prepare("SELECT * FROM dns_records ORDER BY hostname ASC").all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    zoneId: String(row.zone_id),
    bindingId: row.binding_id ? String(row.binding_id) : null,
    hostname: String(row.hostname),
    type: "CNAME",
    content: String(row.content),
    proxied: Number(row.proxied) === 1,
    status: row.status as DnsRecord["status"],
    source: row.source as DnsRecord["source"],
    lastError: row.last_error ? String(row.last_error) : null,
    syncedAt: String(row.synced_at),
  }));
}

export function saveDnsRecord(record: DnsRecord) {
  ensureBaseRows();
  getDb().prepare(`
    INSERT INTO dns_records (id, zone_id, binding_id, hostname, type, content, proxied, status, source, last_error, synced_at)
    VALUES (@id, @zoneId, @bindingId, @hostname, @type, @content, @proxied, @status, @source, @lastError, @syncedAt)
    ON CONFLICT(id) DO UPDATE SET
      zone_id = excluded.zone_id,
      binding_id = excluded.binding_id,
      hostname = excluded.hostname,
      type = excluded.type,
      content = excluded.content,
      proxied = excluded.proxied,
      status = excluded.status,
      source = excluded.source,
      last_error = excluded.last_error,
      synced_at = excluded.synced_at
  `).run({
    ...record,
    proxied: record.proxied ? 1 : 0,
  });
}

export function saveDnsRecords(records: DnsRecord[], zoneIdsToReplace: string[] = []) {
  ensureBaseRows();
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO dns_records (id, zone_id, binding_id, hostname, type, content, proxied, status, source, last_error, synced_at)
    VALUES (@id, @zoneId, @bindingId, @hostname, @type, @content, @proxied, @status, @source, @lastError, @syncedAt)
    ON CONFLICT(id) DO UPDATE SET
      zone_id = excluded.zone_id,
      binding_id = excluded.binding_id,
      hostname = excluded.hostname,
      type = excluded.type,
      content = excluded.content,
      proxied = excluded.proxied,
      status = excluded.status,
      source = excluded.source,
      last_error = excluded.last_error,
      synced_at = excluded.synced_at
  `);

  const tx = db.transaction(() => {
    for (const record of records) {
      upsert.run({
        ...record,
        proxied: record.proxied ? 1 : 0,
      });
    }

    if (zoneIdsToReplace.length > 0) {
      const deleteSql = `
        DELETE FROM dns_records
        WHERE source = 'cloudflare'
          AND zone_id IN (${zoneIdsToReplace.map(() => "?").join(",")})
          ${records.length > 0 ? `AND id NOT IN (${records.map(() => "?").join(",")})` : ""}
      `;
      const params = [
        ...zoneIdsToReplace,
        ...(records.length > 0 ? records.map((record) => record.id) : []),
      ];
      db.prepare(deleteSql).run(...params);
    }
  });

  tx();
}

export function deleteDnsRecordState(recordId: string) {
  ensureBaseRows();
  getDb().prepare("DELETE FROM dns_records WHERE id = ?").run(recordId);
}

export function getSyncStatus(resource: SyncStatus["resource"]): SyncStatus {
  ensureBaseRows();
  const row = getDb().prepare("SELECT * FROM sync_status WHERE resource = ?").get(resource) as Record<string, unknown> | undefined;
  if (!row) {
    return {
      resource,
      state: "idle",
      message: "尚未同步",
      startedAt: null,
      finishedAt: null,
      lastSuccessAt: null,
      zoneCount: 0,
      tunnelCount: 0,
      dnsRecordCount: 0,
      errorDetail: null,
    };
  }

  const zoneCount = getDb().prepare("SELECT COUNT(*) AS count FROM cloudflare_zones").get() as { count?: number };
  const tunnelCount = getDb().prepare("SELECT COUNT(*) AS count FROM cloudflare_tunnels").get() as { count?: number };
  const dnsRecordCount = getDb().prepare("SELECT COUNT(*) AS count FROM dns_records WHERE source = 'cloudflare'").get() as { count?: number };
  const lastSuccessAt = row.state === "healthy" && row.finished_at ? String(row.finished_at) : null;

  return {
    resource,
    state: row.state as SyncStatus["state"],
    message: String(row.message),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    lastSuccessAt,
    zoneCount: Number(zoneCount.count ?? 0),
    tunnelCount: Number(tunnelCount.count ?? 0),
    dnsRecordCount: Number(dnsRecordCount.count ?? 0),
    errorDetail: null,
  };
}

export function updateSyncStatus(resource: SyncStatus["resource"], input: Omit<SyncStatus, "resource">) {
  ensureBaseRows();
  getDb().prepare(`
    INSERT INTO sync_status (resource, state, message, started_at, finished_at)
    VALUES (@resource, @state, @message, @startedAt, @finishedAt)
    ON CONFLICT(resource) DO UPDATE SET
      state = excluded.state,
      message = excluded.message,
      started_at = excluded.started_at,
      finished_at = excluded.finished_at
  `).run({
    resource,
    ...input,
  });
}

export function getLastCloudflaredApply(): CloudflaredApplyResult | null {
  ensureBaseRows();
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get("cloudflared.lastApply") as { value?: string } | undefined;
  if (!row?.value) {
    return null;
  }
  try {
    return normalizeApplyResult(JSON.parse(row.value));
  } catch {
    return null;
  }
}

export function saveLastCloudflaredApply(result: CloudflaredApplyResult) {
  ensureBaseRows();
  getDb().prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run("cloudflared.lastApply", JSON.stringify(normalizeApplyResult(result)));
}

export function getLastCloudflaredDeployment(): CloudflaredDeploymentResult | null {
  ensureBaseRows();
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get("cloudflared.lastDeployment") as { value?: string } | undefined;
  if (!row?.value) {
    return null;
  }
  try {
    return normalizeDeploymentResult(JSON.parse(row.value));
  } catch {
    return null;
  }
}

export function saveLastCloudflaredDeployment(result: CloudflaredDeploymentResult) {
  ensureBaseRows();
  getDb().prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run("cloudflared.lastDeployment", JSON.stringify(normalizeDeploymentResult(result)));
}

export function updateService(id: string, input: Partial<Pick<LocalService, "name" | "scheme" | "host" | "port" | "healthCheckPath">>) {
  ensureBaseRows();
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) { fields.push("name = ?"); values.push(input.name); }
  if (input.scheme !== undefined) { fields.push("scheme = ?"); values.push(input.scheme); }
  if (input.host !== undefined) { fields.push("host = ?"); values.push(input.host); }
  if (input.port !== undefined) { fields.push("port = ?"); values.push(input.port); }
  if (input.healthCheckPath !== undefined) { fields.push("health_check_path = ?"); values.push(input.healthCheckPath); }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  values.push(now());
  values.push(id);
  db.prepare(`UPDATE services SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getService(id);
}

export function deleteService(id: string) {
  ensureBaseRows();
  const db = getDb();
  db.prepare(`DELETE FROM services WHERE id = ?`).run(id);
}
