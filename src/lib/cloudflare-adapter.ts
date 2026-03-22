import { getSettings } from "@/lib/settings";

export type CloudflareZoneSummary = {
  id: string;
  name: string;
  status: string;
};

export type CloudflareTunnelSummary = {
  id: string;
  name: string;
  status: string;
  connectorCount: number;
};

export type CloudflareDnsRecord = {
  id: string;
  zoneId: string;
  hostname: string;
  type: "CNAME";
  content: string;
  proxied: boolean;
};

type CloudflareApiResponse<T> = {
  success: boolean;
  errors?: Array<{ message?: string }>;
  result: T;
};

export class CloudflareAdapter {
  private readonly apiToken: string;
  private readonly accountId: string;

  constructor() {
    const settings = getSettings();
    this.apiToken = settings.cloudflareApiToken;
    this.accountId = settings.cloudflareAccountId;
  }

  isConfigured() {
    return Boolean(this.apiToken && this.accountId);
  }

  headers() {
    if (!this.apiToken) {
      throw new Error("CLOUDFLARE_API_TOKEN is not configured.");
    }

    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  private async readJson<T>(response: Response, fallbackMessage: string) {
    const json = await response.json() as CloudflareApiResponse<T>;
    if (!response.ok || !json.success) {
      throw new Error(json.errors?.[0]?.message || fallbackMessage);
    }
    return json.result;
  }

  async listZones(): Promise<CloudflareZoneSummary[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const response = await fetch("https://api.cloudflare.com/client/v4/zones", {
      headers: this.headers(),
      cache: "no-store",
    });

    const result = await this.readJson<Array<Record<string, unknown>>>(response, "Failed to load Cloudflare zones.");
    return result.map((item) => ({
      id: String(item.id),
      name: String(item.name),
      status: String(item.status),
    }));
  }

  async listTunnels(): Promise<CloudflareTunnelSummary[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/cfd_tunnel`,
      {
        headers: this.headers(),
        cache: "no-store",
      },
    );

    const result = await this.readJson<Array<Record<string, unknown>>>(response, "Failed to load Cloudflare tunnels.");
    return result.map((item) => ({
      id: String(item.id),
      name: String(item.name ?? item.id),
      status: typeof item.status === "string" ? item.status : "unknown",
      connectorCount: Array.isArray(item.connections) ? item.connections.length : 0,
    }));
  }

  async createCnameRecord(zoneId: string, hostname: string, tunnelId: string) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        type: "CNAME",
        name: hostname,
        content: `${tunnelId}.cfargotunnel.com`,
        proxied: true,
      }),
    });

    const result = await this.readJson<Record<string, unknown>>(response, "Failed to create DNS record.");
    return this.mapDnsRecord(zoneId, result);
  }

  async updateDnsRecord(zoneId: string, recordId: string, hostname: string, tunnelId: string) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        type: "CNAME",
        name: hostname,
        content: `${tunnelId}.cfargotunnel.com`,
        proxied: true,
      }),
    });

    const result = await this.readJson<Record<string, unknown>>(response, "Failed to update DNS record.");
    return this.mapDnsRecord(zoneId, result);
  }

  async findDnsRecord(zoneId: string, hostname: string) {
    const query = new URLSearchParams({ name: hostname });
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?${query.toString()}`, {
      headers: this.headers(),
      cache: "no-store",
    });

    const result = await this.readJson<Array<Record<string, unknown>>>(response, "Failed to query DNS records.");
    const record = result[0];
    return record ? this.mapDnsRecord(zoneId, record) : null;
  }

  async listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
    const query = new URLSearchParams({
      type: "CNAME",
      per_page: "500",
    });
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?${query.toString()}`, {
      headers: this.headers(),
      cache: "no-store",
    });

    const result = await this.readJson<Array<Record<string, unknown>>>(response, "Failed to list DNS records.");
    return result.map((item) => this.mapDnsRecord(zoneId, item));
  }

  async deleteDnsRecord(zoneId: string, recordId: string) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
      method: "DELETE",
      headers: this.headers(),
    });

    return this.readJson<Record<string, unknown>>(response, "Failed to delete DNS record.");
  }

  async ensureCnameRecord(zoneId: string, hostname: string, tunnelId: string): Promise<{
    action: "created" | "updated" | "unchanged";
    record: CloudflareDnsRecord;
  }> {
    const desiredContent = `${tunnelId}.cfargotunnel.com`;
    const existing = await this.findDnsRecord(zoneId, hostname);

    if (!existing) {
      const created = await this.createCnameRecord(zoneId, hostname, tunnelId);
      return { action: "created", record: created };
    }

    if (existing.content !== desiredContent || !existing.proxied) {
      const updated = await this.updateDnsRecord(zoneId, existing.id, hostname, tunnelId);
      return { action: "updated", record: updated };
    }

    return { action: "unchanged", record: existing };
  }

  async getTunnelConfig(accountId: string, tunnelId: string): Promise<{ ingress: Array<{ hostname?: string; service: string }> }> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
      {
        headers: this.headers(),
        cache: "no-store",
      },
    );

    const result = await this.readJson<{ config?: { ingress?: Array<{ hostname?: string; service: string }> } }>(
      response,
      "Failed to read remote tunnel ingress.",
    );

    return {
      ingress: result.config?.ingress ?? [],
    };
  }

  async putTunnelConfig(
    accountId: string,
    tunnelId: string,
    ingress: Array<{ hostname?: string; service: string; originRequest?: Record<string, unknown> }>,
  ): Promise<void> {
    const rules = ingress.filter((rule) => rule.hostname);
    rules.push({ service: "http_status:404" });

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
      {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({ config: { ingress: rules } }),
      },
    );

    await this.readJson<Record<string, unknown>>(response, "Failed to update remote tunnel ingress.");
  }

  private mapDnsRecord(zoneId: string, input: Record<string, unknown>): CloudflareDnsRecord {
    return {
      id: String(input.id),
      zoneId,
      hostname: String(input.name),
      type: "CNAME",
      content: String(input.content),
      proxied: Boolean(input.proxied),
    };
  }
}
