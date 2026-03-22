import { createConnection } from "node:net";
import { listBindings, listServices, setBindingStatuses, updateServiceHealth } from "@/lib/repository";
import type { HealthState } from "@/lib/types";

const DEFAULT_TIMEOUT = Number(process.env.HEALTH_TIMEOUT_MS || 3000);

/** HTTP 响应码认为健康 */
const HEALTHY_CODES = new Set([200, 201, 202, 203, 204, 205, 206, 301, 302, 303, 307, 308]);

/** 常见健康检查路径，按优先级依次尝试 */
const FALLBACK_PATHS = ["/health", "/healthz", "/status", "/ready", "/ping", "/"];

function worstState(...states: HealthState[]): HealthState {
  if (states.includes("error")) return "error";
  if (states.includes("warning")) return "warning";
  if (states.includes("unknown")) return "unknown";
  return "healthy";
}

async function tcpCheck(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(false);
    });
    socket.on("timeout", () => {
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(false);
    });
  });
}

async function httpCheck(url: string, timeout: number): Promise<{ healthy: boolean; statusCode: number | null; reason?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(timer);
    if (controller.signal.aborted) return { healthy: false, statusCode: null, reason: "timeout" };
    const healthy = response.status >= 200 && response.status < 400 || HEALTHY_CODES.has(response.status);
    return { healthy, statusCode: response.status };
  } catch (err: unknown) {
    clearTimeout(timer);
    const reason = err instanceof Error ? err.message : "network error";
    return { healthy: false, statusCode: null, reason };
  }
}

export async function checkService(serviceId: string) {
  const service = listServices().find((item) => item.id === serviceId);
  if (!service) throw new Error("服务不存在");

  const base = `${service.scheme}://${service.host}:${service.port}`;
  const timeout = DEFAULT_TIMEOUT;

  // 优先使用服务配置的路径
  const configuredPath = service.healthCheckPath || "/";
  const result = await httpCheck(`${base}${configuredPath}`, timeout);

  if (result.healthy) {
    updateServiceHealth(service.id, { healthy: true, statusCode: result.statusCode });
    return { serviceId: service.id, url: `${base}${configuredPath}`, healthy: true, statusCode: result.statusCode, triedPaths: [configuredPath], tcpChecked: false };
  }

  // 配置路径失败，尝试常见 fallback 路径（跳过已试过的）
  const triedPaths = [configuredPath];
  const triedSet = new Set([configuredPath]);

  for (const path of FALLBACK_PATHS) {
    if (triedSet.has(path)) continue;
    triedSet.add(path);
    triedPaths.push(path);
    const res = await httpCheck(`${base}${path}`, timeout);
    if (res.healthy) {
      updateServiceHealth(service.id, { healthy: true, statusCode: res.statusCode });
      return { serviceId: service.id, url: `${base}${path}`, healthy: true, statusCode: res.statusCode, triedPaths, tcpChecked: false };
    }
  }

  // 所有 HTTP 检查失败，降级为 TCP 端口检测
  const tcpOk = await tcpCheck(service.host, service.port, timeout);

  if (tcpOk) {
    // 端口通但 HTTP 不通：标记 warning（服务在运行但健康检查端点有问题）
    updateServiceHealth(service.id, { healthy: false, statusCode: null });
    return {
      serviceId: service.id,
      url: `${base}${configuredPath}`,
      healthy: false,
      statusCode: null,
      triedPaths,
      tcpChecked: true,
      tcpOk: true,
      warning: "HTTP 检查全部失败，但 TCP 端口可通",
    };
  } else {
    // 端口也不通：真正的 error
    updateServiceHealth(service.id, { healthy: false, statusCode: null });
    return {
      serviceId: service.id,
      url: `${base}${configuredPath}`,
      healthy: false,
      statusCode: null,
      triedPaths,
      tcpChecked: true,
      tcpOk: false,
      error: "HTTP 检查和 TCP 端口检查均失败",
    };
  }
}

export async function checkBinding(bindingId: string) {
  const binding = listBindings().find((item) => item.id === bindingId);
  if (!binding) throw new Error("绑定不存在");

  // DNS 检查：dns_record_id 为 null 说明没有真实落到 Cloudflare
  const dnsStatus: HealthState = binding.dnsRecordId ? binding.dnsStatus : "warning";

  const local = await checkService(binding.serviceId);
  const localStatus: HealthState = local.healthy ? "healthy" : local.tcpOk ? "warning" : "error";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(`https://${binding.hostname}`, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(timer);
    if (controller.signal.aborted) throw new Error("timeout");
    const accessStatus: HealthState = response.status >= 200 && response.status < 400 ? "healthy" : "error";
    const overall = worstState(dnsStatus, localStatus, accessStatus);

    setBindingStatuses(binding.id, { localStatus, accessStatus, dnsStatus });

    return {
      bindingId: binding.id,
      hostname: binding.hostname,
      localHealthy: local.healthy,
      localWarning: local.tcpOk && !local.healthy,
      dnsStatus,
      accessStatus,
      overall,
      statusCode: response.status,
      triedPaths: local.triedPaths,
    };
  } catch {
    clearTimeout(timer);
    const accessStatus: HealthState = "error";
    const overall = worstState(dnsStatus, localStatus, accessStatus);
    setBindingStatuses(binding.id, { localStatus, accessStatus, dnsStatus });

    return {
      bindingId: binding.id,
      hostname: binding.hostname,
      localHealthy: local.healthy,
      localWarning: local.tcpOk && !local.healthy,
      dnsStatus,
      accessStatus,
      overall,
      statusCode: null,
      triedPaths: local.triedPaths,
    };
  }
}
