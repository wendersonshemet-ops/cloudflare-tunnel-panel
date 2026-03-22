import { createHash } from "node:crypto";
import { generateCloudflaredConfig, toYamlLike } from "@/lib/config-generator";
import { listBindings } from "@/lib/repository";
import { CloudflaredConfigVerificationResult, Tunnel } from "@/lib/types";

const REMOTE_CONFIG_PATH = "remote-cloudflare";

function hashContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function now() {
  return new Date().toISOString();
}

export async function stageTunnelConfig(tunnel: Tunnel) {
  const bindings = listBindings();
  const content = toYamlLike(generateCloudflaredConfig(tunnel, bindings));

  return {
    outputPath: REMOTE_CONFIG_PATH,
    stagedPath: "",
    content,
    ingressCount: bindings.filter((binding) => binding.tunnelId === tunnel.id).length,
    configHash: hashContent(content),
  };
}

export async function commitTunnelConfig(_stagedPath: string, _outputPath: string) {
  void _stagedPath;
  void _outputPath;
  return { backupPath: null as string | null };
}

export async function rollbackTunnelConfig(_outputPath: string, _stagedPath: string, _backupPath: string | null) {
  void _outputPath;
  void _stagedPath;
  void _backupPath;
  return { restored: false };
}

export async function verifyTunnelConfig(configPath: string, expectedHash: string): Promise<CloudflaredConfigVerificationResult> {
  return {
    ok: true,
    checkedAt: now(),
    configPath: configPath || REMOTE_CONFIG_PATH,
    expectedHash,
    actualHash: expectedHash,
    message: "Remote-docker-only mode does not write local cloudflared config files.",
    error: null,
  };
}
