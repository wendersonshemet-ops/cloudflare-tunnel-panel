import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { listServices } from "@/lib/repository";
import { getSettings } from "@/lib/settings";
import { LocalService } from "@/lib/types";

const execFileAsync = promisify(execFile);

function now() {
  return new Date().toISOString();
}

function uniqueByAddress(items: LocalService[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.scheme}://${item.host}:${item.port}${item.healthCheckPath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function discoverDockerServices(): Promise<LocalService[]> {
  try {
    const { stdout } = await execFileAsync("docker", ["ps", "--format", "{{.Names}}\t{{.Ports}}"]);
    const lines = stdout.trim().split("\n").filter(Boolean);
    const items: LocalService[] = [];

    for (const line of lines) {
      const [name, portsRaw = ""] = line.split("\t");
      const match = portsRaw.match(/127\.0\.0\.1:(\d+)->|0\.0\.0\.0:(\d+)->|:(\d+)->/);
      const port = Number(match?.[1] || match?.[2] || match?.[3]);
      if (!port) continue;
      items.push({
        id: `docker:${name}:${port}`,
        name,
        scheme: "http",
        host: "127.0.0.1",
        port,
        healthCheckPath: "/",
        source: "docker",
        healthy: false,
        statusCode: null,
        boundHostname: null,
        updatedAt: now(),
      });
    }

    return items;
  } catch {
    return [];
  }
}

async function discoverSystemdServices(): Promise<LocalService[]> {
  try {
    const { stdout } = await execFileAsync("systemctl", ["list-units", "--type=service", "--state=running", "--no-legend"]);
    const lines = stdout.trim().split("\n").filter(Boolean);
    return lines.slice(0, 20).map((line, index) => {
      const name = line.trim().split(/\s+/)[0] || `service-${index + 1}`;
      return {
        id: `systemd:${name}`,
        name,
        scheme: "http" as const,
        host: "127.0.0.1",
        port: 0,
        healthCheckPath: "/",
        source: "systemd" as const,
        healthy: false,
        statusCode: null,
        boundHostname: null,
        updatedAt: now(),
      };
    }).filter((item) => item.port > 0);
  } catch {
    return [];
  }
}

export async function discoverLocalServices() {
  const settings = getSettings();
  const existing = listServices();
  const discovered: LocalService[] = [];

  if (settings.serviceDiscoveryDockerEnabled === "true") {
    discovered.push(...await discoverDockerServices());
  }

  if (settings.serviceDiscoverySystemdEnabled === "true") {
    discovered.push(...await discoverSystemdServices());
  }

  const merged = uniqueByAddress([
    ...existing,
    ...discovered.filter((item) => !existing.some((svc) => svc.name === item.name && svc.port === item.port)),
  ]);

  return {
    existing,
    discovered,
    merged,
    checkedAt: now(),
  };
}
