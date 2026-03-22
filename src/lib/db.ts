import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = process.env.DATABASE_URL
  ? path.isAbsolute(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL
    : path.join(process.cwd(), process.env.DATABASE_URL)
  : path.join(dataDir, "app.db");

function ensureDb() {
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

  const bindingColumns = db.prepare("PRAGMA table_info(bindings)").all() as Array<{ name: string }>;
  const bindingColumnNames = new Set(bindingColumns.map((column) => column.name));
  if (!bindingColumnNames.has("dns_record_id")) {
    db.exec("ALTER TABLE bindings ADD COLUMN dns_record_id TEXT");
  }
  if (!bindingColumnNames.has("dns_record_content")) {
    db.exec("ALTER TABLE bindings ADD COLUMN dns_record_content TEXT");
  }

  return db;
}

let instance: Database.Database | null = null;

export function getDb() {
  if (!instance) {
    instance = ensureDb();
  }
  return instance;
}
