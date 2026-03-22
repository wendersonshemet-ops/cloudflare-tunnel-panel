import { getDb } from "@/lib/db";
import { TunnelSelectionStrategy } from "@/lib/types";

export type AppSettings = {
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  healthTimeoutMs: string;
  tunnelSelectionStrategy: TunnelSelectionStrategy;
  serviceDiscoveryDockerEnabled: string;
  serviceDiscoverySystemdEnabled: string;
  panelPassword: string;
};

const defaults: AppSettings = {
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || "",
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
  healthTimeoutMs: process.env.HEALTH_TIMEOUT_MS || "3000",
  tunnelSelectionStrategy: (process.env.TUNNEL_SELECTION_STRATEGY as TunnelSelectionStrategy | undefined) || "least-bindings",
  serviceDiscoveryDockerEnabled: process.env.SERVICE_DISCOVERY_DOCKER_ENABLED || "false",
  serviceDiscoverySystemdEnabled: process.env.SERVICE_DISCOVERY_SYSTEMD_ENABLED || "false",
  panelPassword: process.env.PANEL_PASSWORD || "",
};

export function getSettings(): AppSettings {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    cloudflareApiToken: map.cloudflareApiToken ?? defaults.cloudflareApiToken,
    cloudflareAccountId: map.cloudflareAccountId ?? defaults.cloudflareAccountId,
    healthTimeoutMs: map.healthTimeoutMs ?? defaults.healthTimeoutMs,
    tunnelSelectionStrategy: (map.tunnelSelectionStrategy as TunnelSelectionStrategy | undefined) ?? defaults.tunnelSelectionStrategy,
    serviceDiscoveryDockerEnabled: map.serviceDiscoveryDockerEnabled ?? defaults.serviceDiscoveryDockerEnabled,
    serviceDiscoverySystemdEnabled: map.serviceDiscoverySystemdEnabled ?? defaults.serviceDiscoverySystemdEnabled,
    panelPassword: map.panelPassword ?? defaults.panelPassword,
  };
}

export function saveSettings(input: Partial<AppSettings>) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      stmt.run(key, value);
    }
  }

  return getSettings();
}
