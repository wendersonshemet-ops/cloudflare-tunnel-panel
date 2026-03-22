export type RecoveryPreviewItem = {
  hostname: string;
  service: string;
  scheme: "http" | "https";
  host: string;
  port: number;
  status: "will-create" | "exists" | "skipped";
  reason: string;
};

function unsupportedError() {
  return new Error("Recovery from local cloudflared config is unsupported in remote-docker-only mode.");
}

export function parseCloudflaredConfig(_filePath: string) {
  void _filePath;
  throw unsupportedError();
}

export async function previewRecoveryFromConfig(_configPath: string): Promise<RecoveryPreviewItem[]> {
  void _configPath;
  throw unsupportedError();
}

export async function restoreFromConfig(_configPath: string) {
  void _configPath;
  throw unsupportedError();
}
