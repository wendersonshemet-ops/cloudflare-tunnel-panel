import { Binding, Tunnel } from "@/lib/types";

export function generateCloudflaredConfig(tunnel: Tunnel, bindings: Binding[]) {
  const ingress = bindings
    .filter((binding) => binding.tunnelId === tunnel.id)
    .map((binding) => ({
      hostname: binding.hostname,
      service: binding.serviceTarget,
    }));

  return {
    tunnel: tunnel.id,
    "credentials-file": `/etc/cloudflared/${tunnel.id}.json`,
    ingress: [
      ...ingress,
      {
        service: "http_status:404",
      },
    ],
  };
}

export function toYamlLike(value: unknown, depth = 0): string {
  const indent = "  ".repeat(depth);

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const entries = Object.entries(item as Record<string, unknown>);
          const [firstKey, firstValue] = entries[0] ?? [];
          const head = `${indent}- ${firstKey}: ${String(firstValue)}`;
          const tail = entries
            .slice(1)
            .map(([key, val]) => `${indent}  ${key}: ${String(val)}`)
            .join("\n");
          return tail ? `${head}\n${tail}` : head;
        }

        return `${indent}- ${String(item)}`;
      })
      .join("\n");
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => {
        if (Array.isArray(val)) {
          return `${indent}${key}:\n${toYamlLike(val, depth + 1)}`;
        }

        if (typeof val === "object" && val !== null) {
          return `${indent}${key}:\n${toYamlLike(val, depth + 1)}`;
        }

        return `${indent}${key}: ${String(val)}`;
      })
      .join("\n");
  }

  return `${indent}${String(value)}`;
}
