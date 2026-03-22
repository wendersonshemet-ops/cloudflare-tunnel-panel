import { CloudflaredApplyResult, CloudflaredServiceCheckResult, CloudflaredValidationResult } from "@/lib/types";

function now() {
  return new Date().toISOString();
}

function unsupportedServiceCheck(message: string): CloudflaredServiceCheckResult {
  return {
    checkedAt: now(),
    source: "unavailable",
    state: "unknown",
    message,
  };
}

export class CloudflaredAdapter {
  async validateConfig(configPath: string): Promise<CloudflaredValidationResult> {
    return {
      ok: true,
      checkedAt: now(),
      configPath: configPath || "remote-cloudflare",
      message: "Remote-docker-only mode publishes ingress through Cloudflare API.",
      stdout: "",
      stderr: "",
      error: null,
    };
  }

  async getInfo() {
    return {
      ok: true,
      version: "remote-docker",
      runtime: "docker-external",
      message: "CTP does not manage the cloudflared container lifecycle. Connector state is observed from Cloudflare.",
    };
  }

  async startService() {
    const serviceCheck = unsupportedServiceCheck(
      "Unsupported in remote-docker-only mode: cloudflared lifecycle is managed externally by Docker.",
    );
    return {
      ok: false,
      action: "start",
      message: serviceCheck.message,
      serviceCheck,
    };
  }

  async stopService() {
    const serviceCheck = unsupportedServiceCheck(
      "Unsupported in remote-docker-only mode: cloudflared lifecycle is managed externally by Docker.",
    );
    return {
      ok: false,
      action: "stop",
      message: serviceCheck.message,
      serviceCheck,
    };
  }

  async applyConfig(configPath: string): Promise<CloudflaredApplyResult> {
    const serviceCheck = unsupportedServiceCheck(
      "CTP does not apply local cloudflared config in remote-docker-only mode.",
    );
    return {
      attempted: false,
      strategy: "none",
      ok: false,
      message: serviceCheck.message,
      checkedAt: now(),
      configPath: configPath || "remote-cloudflare",
      serviceState: serviceCheck.state,
      serviceMessage: serviceCheck.message,
      serviceCheck,
    };
  }
}
