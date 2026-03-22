import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = process.env.PROCESS_STARTED_AT ?? "";
  const now = new Date().toISOString();

  return NextResponse.json({
    ok: true,
    service: "cloudflare-tunnel-panel",
    now,
    startedAt: startedAt || undefined,
    pid: process.pid,
    node: process.version,
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    hostname: process.env.HOSTNAME,
  });
}
