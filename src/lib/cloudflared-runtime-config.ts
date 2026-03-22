import { CloudflareAdapter } from "@/lib/cloudflare-adapter";
import { listBindings } from "@/lib/repository";
import { getSettings } from "@/lib/settings";

const REMOTE_CONFIG_PATH = "remote-cloudflare";

function normalizeService(service: string) {
  return service.trim();
}

function sortIngress(ingress: Array<{ hostname?: string; service: string }>) {
  return [...ingress]
    .filter((rule) => rule.hostname)
    .sort((left, right) => String(left.hostname).localeCompare(String(right.hostname)));
}

export async function inspectCloudflaredRuntimeConfig() {
  const settings = getSettings();
  const cloudflare = new CloudflareAdapter();
  const bindings = listBindings();

  if (!cloudflare.isConfigured() || !settings.cloudflareAccountId) {
    return {
      configPath: REMOTE_CONFIG_PATH,
      exists: false,
      expected: null,
      actual: null,
      status: "unknown" as const,
      message: "Cloudflare API credentials are not configured.",
      diffSummary: null,
    };
  }

  if (bindings.length === 0) {
    return {
      configPath: REMOTE_CONFIG_PATH,
      exists: true,
      expected: "{}",
      actual: "{}",
      status: "unknown" as const,
      message: "No panel bindings exist, so there is no remote ingress to compare.",
      diffSummary: null,
    };
  }

  const tunnelIds = Array.from(new Set(bindings.map((binding) => binding.tunnelId)));
  const expectedByTunnel = new Map<string, Array<{ hostname?: string; service: string }>>();
  const actualByTunnel = new Map<string, Array<{ hostname?: string; service: string }>>();
  const missingHostnames: string[] = [];
  const extraHostnames: string[] = [];
  const mismatchedServices: Array<{ tunnelId: string; hostname: string; expected: string; actual: string }> = [];

  for (const tunnelId of tunnelIds) {
    const expectedIngress = sortIngress(
      bindings
        .filter((binding) => binding.tunnelId === tunnelId)
        .map((binding) => ({ hostname: binding.hostname, service: binding.serviceTarget })),
    );
    expectedByTunnel.set(tunnelId, expectedIngress);
  }

  try {
    for (const tunnelId of tunnelIds) {
      const remoteConfig = await cloudflare.getTunnelConfig(settings.cloudflareAccountId, tunnelId);
      const actualIngress = sortIngress(remoteConfig.ingress);
      actualByTunnel.set(tunnelId, actualIngress);

      const expectedMap = new Map(
        (expectedByTunnel.get(tunnelId) ?? []).map((rule) => [String(rule.hostname), normalizeService(rule.service)]),
      );
      const actualMap = new Map(
        actualIngress.map((rule) => [String(rule.hostname), normalizeService(rule.service)]),
      );

      for (const [hostname, service] of expectedMap) {
        const actual = actualMap.get(hostname);
        if (!actual) {
          missingHostnames.push(hostname);
          continue;
        }
        if (actual !== service) {
          mismatchedServices.push({
            tunnelId,
            hostname,
            expected: service,
            actual,
          });
        }
      }

      for (const hostname of actualMap.keys()) {
        if (!expectedMap.has(hostname)) {
          extraHostnames.push(hostname);
        }
      }
    }
  } catch (error) {
    return {
      configPath: REMOTE_CONFIG_PATH,
      exists: false,
      expected: JSON.stringify(Object.fromEntries(expectedByTunnel), null, 2),
      actual: null,
      status: "error" as const,
      message: error instanceof Error ? error.message : "Failed to read remote tunnel ingress from Cloudflare.",
      diffSummary: null,
    };
  }

  const diffSummary = {
    missingHostnames,
    extraHostnames,
    mismatchedServices,
  };
  const hasDiff = missingHostnames.length > 0 || extraHostnames.length > 0 || mismatchedServices.length > 0;

  return {
    configPath: REMOTE_CONFIG_PATH,
    exists: true,
    expected: JSON.stringify(Object.fromEntries(expectedByTunnel), null, 2),
    actual: JSON.stringify(Object.fromEntries(actualByTunnel), null, 2),
    status: hasDiff ? ("warning" as const) : ("healthy" as const),
    message: hasDiff
      ? "Remote ingress drift detected between panel bindings and Cloudflare."
      : "Remote ingress matches the current panel bindings.",
    diffSummary: hasDiff ? diffSummary : null,
  };
}
