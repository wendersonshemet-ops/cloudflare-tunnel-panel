import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const rootDir = process.cwd();
const dbPath = path.join(rootDir, "data", "readme-demo.db");
const loginDbPath = path.join(rootDir, "data", "readme-login-demo.db");
const now = "2026-03-22T12:00:00.000Z";

for (const basePath of [dbPath, loginDbPath]) {
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = `${basePath}${suffix}`;
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
    }
  }
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scheme TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    health_check_path TEXT NOT NULL,
    source TEXT NOT NULL,
    healthy INTEGER NOT NULL DEFAULT 0,
    status_code INTEGER,
    bound_hostname TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bindings (
    id TEXT PRIMARY KEY,
    zone_id TEXT NOT NULL,
    zone_name TEXT NOT NULL,
    hostname TEXT NOT NULL UNIQUE,
    service_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    service_target TEXT NOT NULL,
    tunnel_id TEXT NOT NULL,
    tunnel_name TEXT NOT NULL,
    dns_status TEXT NOT NULL,
    dns_record_id TEXT,
    dns_record_content TEXT,
    tunnel_status TEXT NOT NULL,
    access_status TEXT NOT NULL,
    local_status TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cloudflare_zones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    synced_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cloudflare_tunnels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    connector_count INTEGER NOT NULL DEFAULT 0,
    synced_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dns_records (
    id TEXT PRIMARY KEY,
    zone_id TEXT NOT NULL,
    binding_id TEXT,
    hostname TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    proxied INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    last_error TEXT,
    synced_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_status (
    resource TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    message TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
  );

  CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    action TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
  );
`);

const services = [
  {
    id: "svc_nas",
    name: "Home NAS",
    scheme: "http",
    host: "127.0.0.1",
    port: 5666,
    health_check_path: "/",
    source: "manual",
    healthy: 1,
    status_code: 200,
    bound_hostname: "nas.example.com",
    updated_at: now,
  },
  {
    id: "svc_docs",
    name: "Docs Portal",
    scheme: "http",
    host: "127.0.0.1",
    port: 8080,
    health_check_path: "/health",
    source: "manual",
    healthy: 1,
    status_code: 200,
    bound_hostname: "app.example.com",
    updated_at: now,
  },
  {
    id: "svc_ai",
    name: "AI Whiteboard",
    scheme: "http",
    host: "127.0.0.1",
    port: 37777,
    health_check_path: "/",
    source: "docker",
    healthy: 0,
    status_code: 502,
    bound_hostname: "preview.lab.example.com",
    updated_at: now,
  },
];

const bindings = [
  {
    id: "bind_nas",
    zone_id: "zone_main",
    zone_name: "example.com",
    hostname: "nas.example.com",
    service_id: "svc_nas",
    service_name: "Home NAS",
    service_target: "http://127.0.0.1:5666",
    tunnel_id: "tunnel_home",
    tunnel_name: "home-tunnel",
    dns_status: "healthy",
    dns_record_id: "dns_nas",
    dns_record_content: "tunnel_home.cfargotunnel.com",
    tunnel_status: "healthy",
    access_status: "healthy",
    local_status: "healthy",
    checked_at: now,
    updated_at: now,
  },
  {
    id: "bind_app",
    zone_id: "zone_main",
    zone_name: "example.com",
    hostname: "app.example.com",
    service_id: "svc_docs",
    service_name: "Docs Portal",
    service_target: "http://127.0.0.1:8080",
    tunnel_id: "tunnel_prod",
    tunnel_name: "prod-tunnel",
    dns_status: "healthy",
    dns_record_id: "dns_app",
    dns_record_content: "tunnel_prod.cfargotunnel.com",
    tunnel_status: "healthy",
    access_status: "healthy",
    local_status: "healthy",
    checked_at: now,
    updated_at: now,
  },
  {
    id: "bind_preview",
    zone_id: "zone_lab",
    zone_name: "lab.example.com",
    hostname: "preview.lab.example.com",
    service_id: "svc_ai",
    service_name: "AI Whiteboard",
    service_target: "http://127.0.0.1:37777",
    tunnel_id: "tunnel_lab",
    tunnel_name: "lab-tunnel",
    dns_status: "healthy",
    dns_record_id: "dns_preview",
    dns_record_content: "tunnel_lab.cfargotunnel.com",
    tunnel_status: "warning",
    access_status: "error",
    local_status: "error",
    checked_at: now,
    updated_at: now,
  },
];

const zones = [
  { id: "zone_main", name: "example.com", status: "active", synced_at: now },
  { id: "zone_lab", name: "lab.example.com", status: "active", synced_at: now },
];

const tunnels = [
  { id: "tunnel_prod", name: "prod-tunnel", status: "online", connector_count: 1, synced_at: now },
  { id: "tunnel_home", name: "home-tunnel", status: "online", connector_count: 1, synced_at: now },
  { id: "tunnel_lab", name: "lab-tunnel", status: "degraded", connector_count: 0, synced_at: now },
];

const dnsRecords = [
  {
    id: "dns_nas",
    zone_id: "zone_main",
    binding_id: "bind_nas",
    hostname: "nas.example.com",
    type: "CNAME",
    content: "tunnel_home.cfargotunnel.com",
    proxied: 1,
    status: "healthy",
    source: "cloudflare",
    last_error: null,
    synced_at: now,
  },
  {
    id: "dns_app",
    zone_id: "zone_main",
    binding_id: "bind_app",
    hostname: "app.example.com",
    type: "CNAME",
    content: "tunnel_prod.cfargotunnel.com",
    proxied: 1,
    status: "healthy",
    source: "cloudflare",
    last_error: null,
    synced_at: now,
  },
  {
    id: "dns_preview",
    zone_id: "zone_lab",
    binding_id: "bind_preview",
    hostname: "preview.lab.example.com",
    type: "CNAME",
    content: "tunnel_lab.cfargotunnel.com",
    proxied: 1,
    status: "healthy",
    source: "cloudflare",
    last_error: null,
    synced_at: now,
  },
];

const settings = [
  ["cloudflareApiToken", ""],
  ["cloudflareAccountId", ""],
  ["healthTimeoutMs", "3000"],
  ["tunnelSelectionStrategy", "least-bindings"],
  ["serviceDiscoveryDockerEnabled", "false"],
  ["serviceDiscoverySystemdEnabled", "false"],
  ["panelPassword", ""],
  [
    "cloudflared.lastApply",
    JSON.stringify({
      attempted: false,
      strategy: "none",
      ok: false,
      message: "Connector lifecycle is externally managed by Docker.",
      checkedAt: now,
      configPath: "remote-cloudflare",
      serviceState: "unknown",
      serviceMessage: "Observation-only mode",
      serviceCheck: {
        checkedAt: now,
        source: "unavailable",
        state: "unknown",
        message: "Observation-only mode",
      },
    }),
  ],
  [
    "cloudflared.lastDeployment",
    JSON.stringify({
      trigger: "manual",
      tunnelId: "tunnel_prod",
      tunnelName: "prod-tunnel",
      ingressCount: 3,
      wroteConfig: false,
      rolledBack: false,
      outputPath: "remote-cloudflare",
      stagedPath: "remote-cloudflare",
      backupPath: null,
      configHash: "demo-readme-config",
      createdAt: now,
      validation: {
        ok: true,
        checkedAt: now,
        configPath: "remote-cloudflare",
        message: "Remote-docker-only mode publishes through the Cloudflare API.",
        stdout: "",
        stderr: "",
        error: null,
      },
      verification: {
        afterCommit: {
          ok: true,
          checkedAt: now,
          configPath: "remote-cloudflare",
          expectedHash: "demo-readme-config",
          actualHash: "demo-readme-config",
          message: "Demo state matches expected remote configuration.",
          error: null,
        },
        afterApply: {
          ok: true,
          checkedAt: now,
          configPath: "remote-cloudflare",
          expectedHash: "demo-readme-config",
          actualHash: "demo-readme-config",
          message: "Demo state matches expected remote configuration.",
          error: null,
        },
      },
      apply: {
        attempted: false,
        strategy: "none",
        ok: false,
        message: "Connector lifecycle is externally managed by Docker.",
        checkedAt: now,
        configPath: "remote-cloudflare",
        serviceState: "unknown",
        serviceMessage: "Observation-only mode",
        serviceCheck: {
          checkedAt: now,
          source: "unavailable",
          state: "unknown",
          message: "Observation-only mode",
        },
      },
      status: {
        level: "healthy",
        phase: "applied",
        configState: "verified",
        serviceState: "unknown",
        summary: "Remote API publish succeeded.",
        checkedAt: now,
      },
    }),
  ],
];

db.transaction(() => {
  const insertService = db.prepare(`
    INSERT INTO services (
      id, name, scheme, host, port, health_check_path, source, healthy, status_code, bound_hostname, updated_at
    ) VALUES (
      @id, @name, @scheme, @host, @port, @health_check_path, @source, @healthy, @status_code, @bound_hostname, @updated_at
    )
  `);
  const insertBinding = db.prepare(`
    INSERT INTO bindings (
      id, zone_id, zone_name, hostname, service_id, service_name, service_target,
      tunnel_id, tunnel_name, dns_status, dns_record_id, dns_record_content,
      tunnel_status, access_status, local_status, checked_at, updated_at
    ) VALUES (
      @id, @zone_id, @zone_name, @hostname, @service_id, @service_name, @service_target,
      @tunnel_id, @tunnel_name, @dns_status, @dns_record_id, @dns_record_content,
      @tunnel_status, @access_status, @local_status, @checked_at, @updated_at
    )
  `);
  const insertZone = db.prepare(`
    INSERT INTO cloudflare_zones (id, name, status, synced_at)
    VALUES (@id, @name, @status, @synced_at)
  `);
  const insertTunnel = db.prepare(`
    INSERT INTO cloudflare_tunnels (id, name, status, connector_count, synced_at)
    VALUES (@id, @name, @status, @connector_count, @synced_at)
  `);
  const insertDns = db.prepare(`
    INSERT INTO dns_records (id, zone_id, binding_id, hostname, type, content, proxied, status, source, last_error, synced_at)
    VALUES (@id, @zone_id, @binding_id, @hostname, @type, @content, @proxied, @status, @source, @last_error, @synced_at)
  `);
  const insertSetting = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
  `);

  services.forEach((row) => insertService.run(row));
  bindings.forEach((row) => insertBinding.run(row));
  zones.forEach((row) => insertZone.run(row));
  tunnels.forEach((row) => insertTunnel.run(row));
  dnsRecords.forEach((row) => insertDns.run(row));
  settings.forEach(([key, value]) => insertSetting.run(key, value));

  db.prepare(`
    INSERT INTO sync_status (resource, state, message, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    "cloudflare",
    "healthy",
    "Using sanitized demo data for README assets.",
    now,
    now,
  );
})();

db.close();

const readonlyDb = new Database(dbPath, { readonly: true });
const safeLoginTarget = loginDbPath.replace(/\\/g, "/").replace(/'/g, "''");
readonlyDb.exec(`VACUUM INTO '${safeLoginTarget}'`);
readonlyDb.close();

const loginDb = new Database(loginDbPath);
loginDb.prepare("UPDATE settings SET value = ? WHERE key = ?").run("demo-password", "panelPassword");
loginDb.close();

console.log(`Seeded README demo database at ${dbPath}`);
console.log(`Seeded README login demo database at ${loginDbPath}`);
