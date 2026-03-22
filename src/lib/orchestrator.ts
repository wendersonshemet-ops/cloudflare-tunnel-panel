import { createHash } from "node:crypto";
import { CloudflareAdapter, CloudflareTunnelSummary } from "@/lib/cloudflare-adapter";
import { summarizeDeploymentStatus } from "@/lib/cloudflared-status";
import { checkBinding } from "@/lib/health";
import {
  attachDnsRecordToBinding,
  clearBindingDnsRecord,
  createBinding,
  deleteBinding,
  deleteDnsRecordState,
  getBinding,
  listBindings,
  saveDnsRecord,
  saveLastCloudflaredApply,
  saveLastCloudflaredDeployment,
  setBindingStatuses,
  updateBinding,
} from "@/lib/repository";
import { conflict, notFound } from "@/lib/errors";
import { appendOperationLog } from "@/lib/operation-logs";
import { syncCloudflareState } from "@/lib/state";
import { selectTunnelByStrategy } from "@/lib/tunnel-selection";
import { getSettings } from "@/lib/settings";
import {
  Binding,
  CloudflaredApplyResult,
  CloudflaredDeploymentResult,
  CloudflaredServiceCheckResult,
  CloudflaredTrigger,
  DnsRecord,
  Tunnel,
} from "@/lib/types";

const REMOTE_CONFIG_PATH = "remote-cloudflare";

function now() {
  return new Date().toISOString();
}

function hashIngress(ingress: Array<{ hostname?: string; service: string }>) {
  return createHash("sha256").update(JSON.stringify(ingress)).digest("hex");
}

function toDnsState(input: {
  id: string;
  zoneId: string;
  bindingId: string;
  hostname: string;
  content: string;
  proxied: boolean;
  source: DnsRecord["source"];
  status: DnsRecord["status"];
  lastError?: string | null;
}): DnsRecord {
  return {
    id: input.id,
    zoneId: input.zoneId,
    bindingId: input.bindingId,
    hostname: input.hostname,
    type: "CNAME",
    content: input.content,
    proxied: input.proxied,
    status: input.status,
    source: input.source,
    lastError: input.lastError ?? null,
    syncedAt: now(),
  };
}

function buildRemoteServiceCheck(tunnelSummary: CloudflareTunnelSummary | undefined): CloudflaredServiceCheckResult {
  const checkedAt = now();

  if (!tunnelSummary) {
    return {
      checkedAt,
      source: "cloudflare",
      state: "unknown",
      message: "Cloudflare did not return connector details for the selected tunnel.",
    };
  }

  if (tunnelSummary.connectorCount > 0) {
    return {
      checkedAt,
      source: "cloudflare",
      state: "running",
      message: `Cloudflare reports ${tunnelSummary.connectorCount} active connector(s).`,
    };
  }

  return {
    checkedAt,
    source: "cloudflare",
    state: "unknown",
    message: "Remote ingress was published, but Cloudflare reports zero active connectors for this tunnel.",
  };
}

function buildRemoteDeployment(input: {
  trigger: CloudflaredTrigger;
  tunnel: Tunnel;
  ingress: Array<{ hostname?: string; service: string }>;
  apply: CloudflaredApplyResult;
  validationMessage?: string;
  verificationMessage?: string;
}): CloudflaredDeploymentResult {
  const checkedAt = input.apply.checkedAt;
  const configHash = hashIngress(input.ingress);

  const deploymentBase: Omit<CloudflaredDeploymentResult, "status"> = {
    trigger: input.trigger,
    tunnelId: input.tunnel.id,
    tunnelName: input.tunnel.name,
    ingressCount: input.ingress.length,
    wroteConfig: input.apply.ok,
    rolledBack: false,
    outputPath: REMOTE_CONFIG_PATH,
    stagedPath: "",
    backupPath: null,
    configHash,
    createdAt: checkedAt,
    validation: {
      ok: true,
      checkedAt,
      configPath: REMOTE_CONFIG_PATH,
      message: input.validationMessage ?? "Remote mode does not write or validate a local cloudflared config file.",
      stdout: "",
      stderr: "",
      error: null,
    },
    verification: {
      afterCommit: {
        ok: input.apply.ok,
        checkedAt,
        configPath: REMOTE_CONFIG_PATH,
        expectedHash: configHash,
        actualHash: input.apply.ok ? configHash : null,
        message: input.verificationMessage ?? (input.apply.ok
          ? "Remote ingress stored in Cloudflare."
          : "Remote ingress was not stored in Cloudflare."),
        error: input.apply.ok ? null : "remote-publish-failed",
      },
      afterApply: {
        ok: input.apply.ok,
        checkedAt,
        configPath: REMOTE_CONFIG_PATH,
        expectedHash: configHash,
        actualHash: input.apply.ok ? configHash : null,
        message: input.apply.ok
          ? "Cloudflare accepted the remote ingress update."
          : input.apply.message,
        error: input.apply.ok ? null : "remote-publish-failed",
      },
    },
    apply: input.apply,
  };

  return {
    ...deploymentBase,
    status: summarizeDeploymentStatus({ ...deploymentBase, status: {} as CloudflaredDeploymentResult["status"] }),
  };
}

function healthFromDeployment(deployment: CloudflaredDeploymentResult): Binding["tunnelStatus"] {
  if (!deployment.apply.ok || deployment.status.level === "error") {
    return "error";
  }
  if (deployment.status.level === "warning") {
    return "warning";
  }
  return "healthy";
}

async function syncAndResolveTunnels(tunnelIds: string[]): Promise<Tunnel[]> {
  await syncCloudflareState();
  const { listTunnelsState } = await import("@/lib/state");
  const tunnels = await listTunnelsState();
  const requested = Array.from(new Set(tunnelIds.filter(Boolean)));
  const resolved = requested.map((tunnelId) => tunnels.find((item) => item.id === tunnelId) ?? null);
  const missing = requested.filter((_, index) => !resolved[index]);

  if (missing.length > 0) {
    throw notFound(`Tunnel not found: ${missing.join(", ")}`);
  }

  return resolved.filter((item): item is Tunnel => Boolean(item));
}

async function ensureDnsRecord(binding: NonNullable<ReturnType<typeof getBinding>>) {
  const cloudflare = new CloudflareAdapter();
  if (!cloudflare.isConfigured()) {
    throw new Error("Cloudflare API is not configured.");
  }

  try {
    const ensured = await cloudflare.ensureCnameRecord(binding.zoneId, binding.hostname, binding.tunnelId);
    saveDnsRecord(toDnsState({
      id: ensured.record.id,
      zoneId: binding.zoneId,
      bindingId: binding.id,
      hostname: ensured.record.hostname,
      content: ensured.record.content,
      proxied: ensured.record.proxied,
      source: "cloudflare",
      status: "healthy",
    }));
    attachDnsRecordToBinding(binding.id, {
      dnsStatus: "healthy",
      recordId: ensured.record.id,
      recordContent: ensured.record.content,
    });
    return {
      managed: true,
      action: ensured.action,
      record: ensured.record,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to manage DNS record.";
    saveDnsRecord(toDnsState({
      id: binding.dnsRecordId ?? `${binding.id}:dns`,
      zoneId: binding.zoneId,
      bindingId: binding.id,
      hostname: binding.hostname,
      content: `${binding.tunnelId}.cfargotunnel.com`,
      proxied: true,
      source: "panel",
      status: "error",
      lastError: message,
    }));
    attachDnsRecordToBinding(binding.id, {
      dnsStatus: "error",
      recordId: binding.dnsRecordId ?? `${binding.id}:dns`,
      recordContent: `${binding.tunnelId}.cfargotunnel.com`,
    });
    throw new Error(`Failed to manage DNS record: ${message}`);
  }
}

async function pushRemoteTunnelConfig(
  tunnel: Tunnel,
  bindings: ReturnType<typeof listBindings>,
  trigger: CloudflaredTrigger,
): Promise<CloudflaredDeploymentResult> {
  const settings = getSettings();
  const cloudflare = new CloudflareAdapter();

  if (!cloudflare.isConfigured() || !settings.cloudflareAccountId) {
    const checkedAt = now();
    const serviceCheck: CloudflaredServiceCheckResult = {
      checkedAt,
      source: "unavailable",
      state: "unknown",
      message: "Cloudflare API credentials are missing.",
    };
    const apply: CloudflaredApplyResult = {
      attempted: false,
      strategy: "none",
      ok: false,
      message: serviceCheck.message,
      checkedAt,
      configPath: REMOTE_CONFIG_PATH,
      serviceState: serviceCheck.state,
      serviceMessage: serviceCheck.message,
      serviceCheck,
    };
    const deployment = buildRemoteDeployment({
      trigger,
      tunnel,
      ingress: [],
      apply,
      validationMessage: "Cloudflare API credentials are required in remote-docker-only mode.",
      verificationMessage: "Remote ingress was not published.",
    });
    saveLastCloudflaredApply(apply);
    saveLastCloudflaredDeployment(deployment);
    return deployment;
  }

  const ingress = bindings
    .filter((binding) => binding.tunnelId === tunnel.id)
    .map((binding) => ({
      hostname: binding.hostname,
      service: binding.serviceTarget,
      originRequest: {},
    }));

  try {
    await cloudflare.putTunnelConfig(settings.cloudflareAccountId, tunnel.id, ingress);
    const tunnelSummary = (await cloudflare.listTunnels()).find((item) => item.id === tunnel.id);
    const serviceCheck = buildRemoteServiceCheck(tunnelSummary);
    const apply: CloudflaredApplyResult = {
      attempted: true,
      strategy: "remote-api",
      ok: true,
      message: `Published ${ingress.length} ingress rule(s) to Cloudflare.`,
      checkedAt: serviceCheck.checkedAt,
      configPath: REMOTE_CONFIG_PATH,
      serviceState: serviceCheck.state,
      serviceMessage: serviceCheck.message,
      serviceCheck,
    };
    const deployment = buildRemoteDeployment({
      trigger,
      tunnel,
      ingress,
      apply,
    });
    saveLastCloudflaredApply(apply);
    saveLastCloudflaredDeployment(deployment);
    appendOperationLog({
      resourceType: "cloudflared",
      resourceId: tunnel.id,
      action: `remote-publish:${trigger}`,
      level: deployment.status.level === "error" ? "error" : deployment.status.level === "warning" ? "warning" : "info",
      message: deployment.status.summary,
      details: {
        tunnelId: tunnel.id,
        tunnelName: tunnel.name,
        ingressCount: ingress.length,
        serviceCheck,
      },
    });
    return deployment;
  } catch (error) {
    const checkedAt = now();
    const message = error instanceof Error ? error.message : "Failed to publish remote ingress.";
    const serviceCheck: CloudflaredServiceCheckResult = {
      checkedAt,
      source: "unavailable",
      state: "unknown",
      message,
    };
    const apply: CloudflaredApplyResult = {
      attempted: true,
      strategy: "remote-api",
      ok: false,
      message,
      checkedAt,
      configPath: REMOTE_CONFIG_PATH,
      serviceState: serviceCheck.state,
      serviceMessage: serviceCheck.message,
      serviceCheck,
    };
    const deployment = buildRemoteDeployment({
      trigger,
      tunnel,
      ingress,
      apply,
      verificationMessage: "Cloudflare rejected the remote ingress update.",
    });
    saveLastCloudflaredApply(apply);
    saveLastCloudflaredDeployment(deployment);
    return deployment;
  }
}

async function publishAffectedTunnels(tunnelIds: string[], trigger: CloudflaredTrigger) {
  const tunnels = await syncAndResolveTunnels(tunnelIds);
  const deployments = await Promise.all(
    tunnels.map((tunnel) => pushRemoteTunnelConfig(tunnel, listBindings(), trigger)),
  );
  const failed = deployments.find((deployment) => !deployment.apply.ok);

  if (failed) {
    throw new Error(failed.apply.message);
  }

  return deployments;
}

export async function applyTunnelConfig(tunnelId: string) {
  const [deployment] = await publishAffectedTunnels([tunnelId], "manual");
  return deployment;
}

export async function applyPrimaryTunnelConfig() {
  await syncCloudflareState();
  const { listTunnelsState } = await import("@/lib/state");
  const tunnels = await listTunnelsState();
  const strategy = getSettings().tunnelSelectionStrategy;
  const tunnel = selectTunnelByStrategy(tunnels, strategy, "default") ?? tunnels[0];

  if (!tunnel) {
    throw new Error("No tunnel is available.");
  }

  const [deployment] = await publishAffectedTunnels([tunnel.id], "manual");
  return {
    tunnel,
    deployment,
  };
}

export async function syncBindingDns(bindingId: string) {
  const binding = getBinding(bindingId);
  if (!binding) {
    throw notFound("Binding not found.");
  }

  const dns = await ensureDnsRecord(binding);
  return {
    binding: getBinding(bindingId),
    dns,
  };
}

export async function publishBinding(input: {
  zoneId: string;
  zoneName: string;
  hostname: string;
  serviceId: string;
  tunnelId: string;
  tunnelName: string;
}) {
  const existing = listBindings().find((item) => item.hostname === input.hostname);
  if (existing) {
    throw conflict(`Hostname already exists: ${input.hostname}`, { bindingId: existing.id });
  }

  const binding = createBinding(input);
  appendOperationLog({
    resourceType: "binding",
    resourceId: binding.id,
    action: "publish:start",
    level: "info",
    message: `Publishing binding ${binding.hostname}`,
    details: input,
  });

  try {
    const [deployment] = await publishAffectedTunnels([binding.tunnelId], "binding-create");
    const tunnelStatus = healthFromDeployment(deployment);

    setBindingStatuses(binding.id, {
      localStatus: binding.localStatus,
      accessStatus: "unknown",
      tunnelStatus,
    });

    const dns = await ensureDnsRecord(getBinding(binding.id)!);
    const checked = await checkBinding(binding.id);
    appendOperationLog({
      resourceType: "binding",
      resourceId: binding.id,
      action: "publish:success",
      level: tunnelStatus === "healthy" ? "info" : "warning",
      message: `Binding published for ${binding.hostname}`,
      details: {
        deployment: deployment.status,
        dnsAction: dns.action,
        checked,
      },
    });

    return {
      binding: getBinding(binding.id),
      deployment,
      dns,
      checked,
    };
  } catch (error) {
    appendOperationLog({
      resourceType: "binding",
      resourceId: binding.id,
      action: "publish:failed",
      level: "error",
      message: error instanceof Error ? error.message : "Failed to publish binding.",
      details: input,
    });
    deleteBinding(binding.id);
    throw error;
  }
}

export async function updatePublishedBinding(bindingId: string, input: {
  zoneId: string;
  zoneName: string;
  hostname: string;
  serviceId: string;
  tunnelId: string;
  tunnelName: string;
}) {
  const previous = getBinding(bindingId);
  if (!previous) {
    throw notFound("Binding not found.");
  }

  const updated = updateBinding(bindingId, input);
  if (!updated) {
    throw new Error("Failed to update binding.");
  }

  const affectedTunnelIds = Array.from(new Set([previous.tunnelId, updated.tunnelId]));

  try {
    const deployments = await publishAffectedTunnels(affectedTunnelIds, "binding-update");
    const currentDeployment = deployments.find((deployment) => deployment.tunnelId === updated.tunnelId) ?? deployments[0];
    const cloudflare = new CloudflareAdapter();
    const dnsChanges = {
      deletedOld: false,
      action: "skipped" as "created" | "updated" | "unchanged" | "skipped",
    };

    if ((previous.hostname !== updated.hostname || previous.zoneId !== updated.zoneId) && previous.dnsRecordId) {
      await cloudflare.deleteDnsRecord(previous.zoneId, previous.dnsRecordId);
      deleteDnsRecordState(previous.dnsRecordId);
      dnsChanges.deletedOld = true;
    }

    const dns = await ensureDnsRecord(getBinding(bindingId)!);
    dnsChanges.action = dns.action;

    setBindingStatuses(bindingId, {
      localStatus: updated.localStatus,
      accessStatus: "unknown",
      tunnelStatus: healthFromDeployment(currentDeployment),
    });

    const checked = await checkBinding(bindingId);
    return {
      binding: getBinding(bindingId),
      previous,
      deployment: currentDeployment,
      deployments,
      dnsChanges,
      checked,
    };
  } catch (error) {
    updateBinding(bindingId, {
      zoneId: previous.zoneId,
      zoneName: previous.zoneName,
      hostname: previous.hostname,
      serviceId: previous.serviceId,
      tunnelId: previous.tunnelId,
      tunnelName: previous.tunnelName,
    });

    try {
      await publishAffectedTunnels(affectedTunnelIds, "binding-update");
    } catch {
      // Best-effort rollback of remote ingress after local state revert.
    }

    throw error;
  }
}

export async function unpublishBinding(bindingId: string) {
  const binding = getBinding(bindingId);
  if (!binding) {
    throw notFound("Binding not found.");
  }

  appendOperationLog({
    resourceType: "binding",
    resourceId: bindingId,
    action: "unpublish:start",
    level: "info",
    message: `Removing binding ${binding.hostname}`,
  });

  const cloudflare = new CloudflareAdapter();
  let dnsDeleted = false;
  if (cloudflare.isConfigured() && binding.dnsRecordId) {
    await cloudflare.deleteDnsRecord(binding.zoneId, binding.dnsRecordId);
    deleteDnsRecordState(binding.dnsRecordId);
    dnsDeleted = true;
  }

  const removed = deleteBinding(bindingId);
  let deployment: CloudflaredDeploymentResult | null = null;

  try {
    [deployment] = await publishAffectedTunnels([binding.tunnelId], "binding-delete");
  } catch {
    deployment = null;
  }

  appendOperationLog({
    resourceType: "binding",
    resourceId: bindingId,
    action: "unpublish:done",
    level: deployment?.apply.ok === false ? "warning" : "info",
    message: `Binding removed for ${binding.hostname}`,
    details: {
      dnsDeleted,
      deployment: deployment?.status ?? null,
    },
  });

  return {
    removed,
    dnsDeleted,
    deployment,
  };
}

export async function detachBindingDns(bindingId: string) {
  const binding = getBinding(bindingId);
  if (!binding) {
    throw notFound("Binding not found.");
  }

  const cloudflare = new CloudflareAdapter();
  let deleted = false;

  if (cloudflare.isConfigured() && binding.dnsRecordId) {
    await cloudflare.deleteDnsRecord(binding.zoneId, binding.dnsRecordId);
    deleteDnsRecordState(binding.dnsRecordId);
    deleted = true;
  }

  clearBindingDnsRecord(bindingId, "warning");
  return {
    binding: getBinding(bindingId),
    deleted,
  };
}
