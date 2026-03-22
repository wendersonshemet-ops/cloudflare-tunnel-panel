export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string; code?: string; details?: unknown } };

export async function parseJson<T>(res: Response): Promise<ApiEnvelope<T>> {
  const data = await res.json().catch(() => null);
  if (data && typeof data === "object" && "ok" in data) {
    return data as ApiEnvelope<T>;
  }
  if (!res.ok) {
    return { ok: false, error: { message: (data && (data.error || data.message)) || `HTTP ${res.status}` } };
  }
  return { ok: true, data } as ApiEnvelope<T>;
}

export function formatApiError(err: unknown): string {
  if (!err) return "请求失败";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const objectErr = err as { message?: unknown; error?: { message?: unknown; details?: unknown }; details?: unknown };
    const message =
      objectErr.message ? String(objectErr.message)
        : objectErr.error?.message ? String(objectErr.error.message)
          : "";
    const details = objectErr.details ?? objectErr.error?.details;

    if (details && typeof details === "object") {
      const flattened = Object.values(details as Record<string, unknown>)
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      if (flattened.length > 0) {
        return message ? `${message}：${flattened.join("；")}` : flattened.join("；");
      }
    }

    if (message) return message;
  }
  return "请求失败";
}
