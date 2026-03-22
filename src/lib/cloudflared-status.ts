import {
  CloudflaredApplyResult,
  CloudflaredConfigVerificationResult,
  CloudflaredDeploymentResult,
  CloudflaredDeploymentStatus,
  CloudflaredServiceCheckResult,
} from "@/lib/types";

function now() {
  return new Date().toISOString();
}

function normalizeVerification(
  value: Partial<CloudflaredConfigVerificationResult> | null | undefined,
  fallbackPath: string | null,
  fallbackHash: string | null,
  fallbackMessage: string,
): CloudflaredConfigVerificationResult {
  return {
    ok: value?.ok ?? false,
    checkedAt: value?.checkedAt ?? now(),
    configPath: value?.configPath ?? fallbackPath ?? "",
    expectedHash: value?.expectedHash ?? fallbackHash ?? "",
    actualHash: value?.actualHash ?? null,
    message: value?.message ?? fallbackMessage,
    error: value?.error ?? (value?.ok ? null : "unknown"),
  };
}

export function normalizeServiceCheck(
  value: Partial<CloudflaredServiceCheckResult> | null | undefined,
  fallback: Pick<CloudflaredApplyResult, "serviceState" | "serviceMessage" | "checkedAt">,
): CloudflaredServiceCheckResult {
  return {
    checkedAt: value?.checkedAt ?? fallback.checkedAt ?? now(),
    source: value?.source ?? "unavailable",
    state: value?.state ?? fallback.serviceState ?? "unknown",
    message: value?.message ?? fallback.serviceMessage ?? "未执行服务检查",
  };
}

export function normalizeApplyResult(value: Partial<CloudflaredApplyResult> | null | undefined): CloudflaredApplyResult | null {
  if (!value) {
    return null;
  }

  const checkedAt = value.checkedAt ?? now();
  const serviceState = value.serviceState ?? value.serviceCheck?.state ?? "unknown";
  const serviceMessage = value.serviceMessage ?? value.serviceCheck?.message ?? "未执行服务检查";

  return {
    attempted: value.attempted ?? false,
    strategy: value.strategy ?? "none",
    ok: value.ok ?? false,
    message: value.message ?? "未执行应用",
    checkedAt,
    configPath: value.configPath ?? null,
    serviceState,
    serviceMessage,
    serviceCheck: normalizeServiceCheck(value.serviceCheck, {
      serviceState,
      serviceMessage,
      checkedAt,
    }),
  };
}

export function summarizeDeploymentStatus(deployment: CloudflaredDeploymentResult): CloudflaredDeploymentStatus {
  if (!deployment.validation.ok) {
    return {
      level: "error",
      phase: "validation_failed",
      configState: "unknown",
      serviceState: deployment.apply.serviceState,
      summary: deployment.validation.message,
      checkedAt: deployment.validation.checkedAt,
    };
  }

  if (deployment.rolledBack) {
    return {
      level: "error",
      phase: "rolled_back",
      configState: "rolled-back",
      serviceState: deployment.apply.serviceState,
      summary: deployment.apply.message,
      checkedAt: deployment.apply.checkedAt,
    };
  }

  if (!deployment.verification.afterCommit.ok) {
    return {
      level: "error",
      phase: "apply_failed",
      configState: "mismatch",
      serviceState: deployment.apply.serviceState,
      summary: deployment.verification.afterCommit.message,
      checkedAt: deployment.verification.afterCommit.checkedAt,
    };
  }

  if (!deployment.apply.attempted) {
    return {
      level: "warning",
      phase: "validated",
      configState: "verified",
      serviceState: deployment.apply.serviceState,
      summary: deployment.apply.message,
      checkedAt: deployment.apply.checkedAt,
    };
  }

  if (!deployment.apply.ok) {
    return {
      level: "error",
      phase: "apply_failed",
      configState: deployment.verification.afterApply.ok ? "verified" : "mismatch",
      serviceState: deployment.apply.serviceState,
      summary: deployment.apply.message,
      checkedAt: deployment.apply.checkedAt,
    };
  }

  if (!deployment.verification.afterApply.ok) {
    return {
      level: "error",
      phase: "apply_failed",
      configState: "mismatch",
      serviceState: deployment.apply.serviceState,
      summary: deployment.verification.afterApply.message,
      checkedAt: deployment.verification.afterApply.checkedAt,
    };
  }

  if (deployment.apply.serviceState === "stopped") {
    return {
      level: "error",
      phase: "applied",
      configState: "verified",
      serviceState: deployment.apply.serviceState,
      summary: deployment.apply.message,
      checkedAt: deployment.apply.checkedAt,
    };
  }

  if (deployment.apply.serviceState === "unknown") {
    return {
      level: "warning",
      phase: "applied",
      configState: "verified",
      serviceState: deployment.apply.serviceState,
      summary: deployment.apply.message,
      checkedAt: deployment.apply.checkedAt,
    };
  }

  return {
    level: "healthy",
    phase: "applied",
    configState: "verified",
    serviceState: deployment.apply.serviceState,
    summary: "配置已应用，文件与服务状态已确认",
    checkedAt: deployment.apply.checkedAt,
  };
}

export function normalizeDeploymentResult(value: Partial<CloudflaredDeploymentResult> | null | undefined): CloudflaredDeploymentResult | null {
  if (!value) {
    return null;
  }

  const apply = normalizeApplyResult(value.apply);
  if (!apply) {
    return null;
  }

  const normalized: Omit<CloudflaredDeploymentResult, "status"> = {
    trigger: value.trigger ?? "manual",
    tunnelId: value.tunnelId ?? "",
    tunnelName: value.tunnelName ?? "",
    ingressCount: value.ingressCount ?? 0,
    wroteConfig: value.wroteConfig ?? false,
    rolledBack: value.rolledBack ?? false,
    outputPath: value.outputPath ?? apply.configPath ?? "",
    stagedPath: value.stagedPath ?? "",
    backupPath: value.backupPath ?? null,
    configHash: value.configHash ?? "",
    createdAt: value.createdAt ?? apply.checkedAt,
    validation: {
      ok: value.validation?.ok ?? false,
      checkedAt: value.validation?.checkedAt ?? apply.checkedAt,
      configPath: value.validation?.configPath ?? value.outputPath ?? apply.configPath ?? "",
      message: value.validation?.message ?? "未执行配置校验",
      stdout: value.validation?.stdout ?? "",
      stderr: value.validation?.stderr ?? "",
      error: value.validation?.error ?? (value.validation?.ok ? null : "unknown"),
    },
    verification: {
      afterCommit: normalizeVerification(
        value.verification?.afterCommit,
        value.outputPath ?? apply.configPath ?? null,
        value.configHash ?? null,
        "未执行落盘校验",
      ),
      afterApply: normalizeVerification(
        value.verification?.afterApply,
        value.outputPath ?? apply.configPath ?? null,
        value.configHash ?? null,
        "未执行应用后校验",
      ),
    },
    apply,
  };

  const deployment = {
    ...normalized,
    status: value.status ?? ({
      level: "unknown",
      phase: "validated",
      configState: "unknown",
      serviceState: apply.serviceState,
      summary: "",
      checkedAt: apply.checkedAt,
    } as CloudflaredDeploymentStatus),
  } satisfies CloudflaredDeploymentResult;

  deployment.status = value.status ?? summarizeDeploymentStatus(deployment);
  return deployment;
}
