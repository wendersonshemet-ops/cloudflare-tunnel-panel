import { Binding, DnsRecord } from "@/lib/types";

export type DnsDiff = {
  bindingId: string | null;
  hostname: string;
  zoneId: string;
  expectedContent: string | null;
  actualContent: string | null;
  expectedProxied: boolean | null;
  actualProxied: boolean | null;
  status: "healthy" | "missing" | "mismatch" | "orphan";
  message: string;
};

export function buildDnsDiffs(bindings: Binding[], records: DnsRecord[]): DnsDiff[] {
  const byZoneHost = new Map(records.map((record) => [`${record.zoneId}:${record.hostname}`, record]));
  const diffs: DnsDiff[] = [];

  for (const binding of bindings) {
    const actual = byZoneHost.get(`${binding.zoneId}:${binding.hostname}`) ?? null;
    const expectedContent = `${binding.tunnelId}.cfargotunnel.com`;

    if (!actual) {
      diffs.push({
        bindingId: binding.id,
        hostname: binding.hostname,
        zoneId: binding.zoneId,
        expectedContent,
        actualContent: null,
        expectedProxied: true,
        actualProxied: null,
        status: "missing",
        message: "Cloudflare 中缺少期望的 DNS 记录",
      });
      continue;
    }

    const matches = actual.content === expectedContent && actual.proxied;
    diffs.push({
      bindingId: binding.id,
      hostname: binding.hostname,
      zoneId: binding.zoneId,
      expectedContent,
      actualContent: actual.content,
      expectedProxied: true,
      actualProxied: actual.proxied,
      status: matches ? "healthy" : "mismatch",
      message: matches ? "DNS 记录与绑定期望一致" : "DNS 记录与绑定期望不一致",
    });
  }

  for (const record of records) {
    const matched = bindings.find((binding) => binding.zoneId === record.zoneId && binding.hostname === record.hostname);
    if (matched) continue;
    diffs.push({
      bindingId: null,
      hostname: record.hostname,
      zoneId: record.zoneId,
      expectedContent: null,
      actualContent: record.content,
      expectedProxied: null,
      actualProxied: record.proxied,
      status: "orphan",
      message: "该 DNS 记录未被任何绑定使用",
    });
  }

  return diffs.sort((a, b) => a.hostname.localeCompare(b.hostname));
}
