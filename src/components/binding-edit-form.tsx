"use client";
import { useRouter } from "next/navigation";

import { BindingPreflightButton } from "@/components/binding-preflight-button";
import { EmptyState } from "@/components/ui";
import { formatApiError } from "@/lib/client-api";
import { Binding, LocalService, Tunnel, Zone } from "@/lib/types";
import { useId, useMemo, useState } from "react";
import styles from "./forms.module.css";

function validateSubdomain(value: string) {
  const input = value.trim();
  if (!input) return "请输入子域名前缀。";
  if (!/^[a-z0-9-]+$/i.test(input)) return "仅支持字母、数字和中划线。";
  if (input.startsWith("-") || input.endsWith("-")) return "不能以中划线开头或结尾。";
  if (input.length > 63) return "单个子域标签最长 63 个字符。";
  return "";
}

function validateBindingForm(form: {
  zoneId: string;
  subdomain: string;
  serviceId: string;
  tunnelId: string;
}) {
  const nextErrors: { zoneId?: string; subdomain?: string; serviceId?: string; tunnelId?: string } = {};
  if (!form.zoneId) nextErrors.zoneId = "请先选择一个 Zone。";
  const subdomainError = validateSubdomain(form.subdomain);
  if (subdomainError) nextErrors.subdomain = subdomainError;
  if (!form.serviceId) nextErrors.serviceId = "请选择目标服务。";
  if (!form.tunnelId) nextErrors.tunnelId = "请选择 Tunnel。";
  return nextErrors;
}

export function BindingEditForm({ binding, zones, tunnels, services, onClose }: {
  binding: Binding;
  zones: Zone[];
  tunnels: Tunnel[];
  services: LocalService[];
  onClose: () => void;
}) {
  const router = useRouter();
  const formId = useId();
  const [form, setForm] = useState({
    zoneId: binding.zoneId,
    zoneName: binding.zoneName,
    subdomain: binding.hostname.replace(`.${binding.zoneName}`, ""),
    serviceId: binding.serviceId,
    tunnelId: binding.tunnelId,
    tunnelName: binding.tunnelName,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ zoneId?: string; subdomain?: string; serviceId?: string; tunnelId?: string }>({});
  const liveErrors = validateBindingForm(form);
  const hasBlockingErrors = Object.keys(liveErrors).length > 0;
  const errorEntries = Object.entries(fieldErrors).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const submitLabel = loading ? "保存中..." : hasBlockingErrors ? `请先修正 ${Object.keys(liveErrors).length} 项` : "保存修改";

  const hostname = useMemo(() => {
    if (!form.subdomain || !form.zoneName) return "";
    return `${form.subdomain}.${form.zoneName}`;
  }, [form.subdomain, form.zoneName]);

  if (zones.length === 0 || tunnels.length === 0 || services.length === 0) {
    return (
      <EmptyState
        icon="binding"
        title="无法编辑绑定"
        message="编辑绑定需要 Zone、Tunnel 和本地服务数据完整可用。"
        hint="先同步基础资源或补齐服务数据，再重新打开编辑器。"
      />
    );
  }

  function updateForm(nextForm: typeof form) {
    setForm(nextForm);
    setFieldErrors(validateBindingForm(nextForm));
    if (error) setError("");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const nextErrors = validateBindingForm(form);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setLoading(false);
      setError("请先修正表单中的字段问题。");
      return;
    }
    try {
      const res = await fetch(`/api/bindings/${binding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneId: form.zoneId,
          zoneName: form.zoneName,
          hostname,
          serviceId: form.serviceId,
          tunnelId: form.tunnelId,
          tunnelName: form.tunnelName,
        }),
      });
      const env = await (await import("@/lib/client-api")).parseJson<{ binding: { id: string } }>(res);
      if (!env.ok) {
        throw new Error(formatApiError(env.error));
      }
      router.refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h3>访问地址</h3>
          <p>修改域名或子域前缀后，最终公开地址会立即变化。</p>
        </div>
        <div className={styles.row}>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.zoneId)}>
            <label htmlFor={`${formId}-zone`}>域名<span className={styles.required}>必填</span></label>
            <select
              id={`${formId}-zone`}
              value={form.zoneId}
              aria-invalid={Boolean(fieldErrors.zoneId)}
              aria-describedby={`${formId}-zone-hint${fieldErrors.zoneId ? ` ${formId}-zone-error` : ""}`}
              onChange={(e) => {
                const zone = zones.find((item) => item.id === e.target.value);
                updateForm({ ...form, zoneId: e.target.value, zoneName: zone?.name ?? "" });
              }}
            >
              <option value="" disabled>请选择一个 Zone</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
            {fieldErrors.zoneId ? <p className={styles.fieldError} id={`${formId}-zone-error`}>{fieldErrors.zoneId}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-zone-hint`}>修改根域名会直接改变对外暴露的完整地址。</p>
          </div>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.subdomain)}>
            <label htmlFor={`${formId}-subdomain`}>子域名前缀<span className={styles.required}>必填</span></label>
            <input id={`${formId}-subdomain`} value={form.subdomain} onChange={(e) => updateForm({ ...form, subdomain: e.target.value.toLowerCase().replace(/\s+/g, "") })} placeholder="例如：panel、api、admin" aria-invalid={Boolean(fieldErrors.subdomain)} aria-describedby={`${formId}-subdomain-hint${fieldErrors.subdomain ? ` ${formId}-subdomain-error` : ""}`} />
            {fieldErrors.subdomain ? <p className={styles.fieldError} id={`${formId}-subdomain-error`}>{fieldErrors.subdomain}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-subdomain-hint`}>修改前缀时只填写左侧标签，系统会自动拼接完整域名。</p>
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h3>转发目标</h3>
          <p>重新选择服务或 Tunnel 前，先确认流量切换是否符合预期。</p>
        </div>
        <div className={styles.row}>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.serviceId)}>
            <label htmlFor={`${formId}-service`}>目标服务<span className={styles.required}>必填</span></label>
            <select id={`${formId}-service`} value={form.serviceId} onChange={(e) => updateForm({ ...form, serviceId: e.target.value })} aria-invalid={Boolean(fieldErrors.serviceId)} aria-describedby={`${formId}-service-hint${fieldErrors.serviceId ? ` ${formId}-service-error` : ""}`}>
              <option value="" disabled>请选择目标服务</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>{service.name} ({service.host}:{service.port})</option>
              ))}
            </select>
            {fieldErrors.serviceId ? <p className={styles.fieldError} id={`${formId}-service-error`}>{fieldErrors.serviceId}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-service-hint`}>切换目标服务前，先确认新服务的健康检查和监听地址已经就绪。</p>
          </div>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.tunnelId)}>
            <label htmlFor={`${formId}-tunnel`}>Tunnel<span className={styles.required}>必填</span></label>
            <select
              id={`${formId}-tunnel`}
              value={form.tunnelId}
              aria-invalid={Boolean(fieldErrors.tunnelId)}
              aria-describedby={`${formId}-tunnel-hint${fieldErrors.tunnelId ? ` ${formId}-tunnel-error` : ""}`}
              onChange={(e) => {
                const tunnel = tunnels.find((item) => item.id === e.target.value);
                updateForm({ ...form, tunnelId: e.target.value, tunnelName: tunnel?.name ?? "" });
              }}
            >
              <option value="" disabled>请选择一个 Tunnel</option>
              {tunnels.map((tunnel) => (
                <option key={tunnel.id} value={tunnel.id}>{tunnel.name}</option>
              ))}
            </select>
            {fieldErrors.tunnelId ? <p className={styles.fieldError} id={`${formId}-tunnel-error`}>{fieldErrors.tunnelId}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-tunnel-hint`}>如需确认是否存在冲突，可先执行预检再保存修改。</p>
          </div>
        </div>
      </section>

      <div className={styles.preview}>
        <span className={styles.previewLabel}>修改后访问地址</span>
        <span className={hostname ? styles.previewValue : styles.previewMuted}>{hostname || "请补充子域名前缀"}</span>
      </div>
      <BindingPreflightButton
        payload={{
          hostname,
          serviceId: form.serviceId,
          zoneId: form.zoneId,
          zoneName: form.zoneName,
          tunnelId: form.tunnelId || undefined,
        }}
      />
      <div className={styles.formActions}>
        {errorEntries.length > 0 ? (
          <div className={styles.summary} role="alert">
            <p className={styles.summaryTitle}>仍有 {errorEntries.length} 项需要处理</p>
            <ul className={styles.summaryList}>
              {errorEntries.map(([key, value]) => (
                <li key={key}>{value}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? <p className={`${styles.message} ${styles.error}`} role="alert">{error}</p> : null}
        <div className={styles.fieldMeta}>
          <p className={styles.actionHint}>{hasBlockingErrors ? "请先补全必填项并修正子域格式。" : "保存后会立即更新绑定目标，并影响后续 DNS / 配置操作。"}</p>
          <div className={styles.inlineButtons}>
            <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={loading}>取消</button>
            <button className={styles.button} type="submit" disabled={loading || hasBlockingErrors || !hostname} aria-busy={loading}>
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
