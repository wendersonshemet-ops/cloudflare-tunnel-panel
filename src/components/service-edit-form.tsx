"use client";
import { useRouter } from "next/navigation";

import { formatApiError } from "@/lib/client-api";
import { useId, useState } from "react";
import { useToast } from "@/components/toast";
import { LocalService } from "@/lib/types";
import styles from "./forms.module.css";

function validateHost(value: string) {
  const host = value.trim();
  if (!host) return "请输入主机地址，例如 127.0.0.1、localhost 或内网 IP。";
  if (/\s/.test(host)) return "主机地址不能包含空格。";
  return "";
}

function validateHealthCheckPath(value: string) {
  const path = value.trim();
  if (!path) return "";
  if (!path.startsWith("/")) return "健康检查路径需要以 / 开头。";
  return "";
}

function validateServiceForm(form: {
  name: string;
  host: string;
  port: string;
  healthCheckPath: string;
}) {
  const nextErrors: { name?: string; host?: string; port?: string; healthCheckPath?: string } = {};
  if (!form.name.trim()) nextErrors.name = "请填写服务名。";
  const hostError = validateHost(form.host);
  if (hostError) nextErrors.host = hostError;
  if (!form.port || Number.isNaN(Number(form.port))) {
    nextErrors.port = "请输入有效端口号。";
  } else if (Number(form.port) < 1 || Number(form.port) > 65535) {
    nextErrors.port = "端口范围必须在 1 到 65535 之间。";
  }
  const healthCheckPathError = validateHealthCheckPath(form.healthCheckPath);
  if (healthCheckPathError) nextErrors.healthCheckPath = healthCheckPathError;
  return nextErrors;
}

export function ServiceEditForm({ service, onDone }: { service: LocalService; onDone: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const formId = useId();
  const [form, setForm] = useState({
    name: service.name,
    scheme: service.scheme,
    host: service.host,
    port: String(service.port),
    healthCheckPath: service.healthCheckPath,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; host?: string; port?: string; healthCheckPath?: string }>({});
  const liveErrors = validateServiceForm(form);
  const hasBlockingErrors = Object.keys(liveErrors).length > 0;
  const errorEntries = Object.entries(fieldErrors).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const submitLabel = loading ? "保存中..." : hasBlockingErrors ? `请先修正 ${Object.keys(liveErrors).length} 项` : "保存";

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    const nextForm = { ...form, [k]: v };
    setForm(nextForm);
    setFieldErrors(validateServiceForm(nextForm));
    if (error) setError("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const nextErrors = validateServiceForm(form);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("请先修正表单中的字段问题。");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          host: form.host.trim(),
          port: Number(form.port),
          healthCheckPath: form.healthCheckPath.trim() || "/",
        }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error?.message || "更新失败");
      toast(`已更新服务：${form.name}`, "success");
      router.refresh();
    } catch (err) {
      const message = formatApiError(err);
      setError(message);
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h3>基础信息</h3>
          <p>调整服务名、协议和目标地址后会立即影响后续绑定。</p>
        </div>
        <div className={styles.row}>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.name)}>
            <label htmlFor={`${formId}-name`}>服务名<span className={styles.required}>必填</span></label>
            <input id={`${formId}-name`} value={form.name} onChange={(e) => set("name", e.target.value)} required aria-invalid={Boolean(fieldErrors.name)} aria-describedby={`${formId}-name-hint${fieldErrors.name ? ` ${formId}-name-error` : ""}`} placeholder="例如：后台管理、API 网关、Grafana" />
            {fieldErrors.name ? <p className={styles.fieldError} id={`${formId}-name-error`}>{fieldErrors.name}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-name-hint`}>建议使用业务可识别名称，避免在绑定列表中混淆。</p>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${formId}-scheme`}>协议<span className={styles.required}>必填</span></label>
            <select id={`${formId}-scheme`} value={form.scheme} onChange={(e) => set("scheme", e.target.value as typeof form.scheme)} aria-describedby={`${formId}-scheme-hint`}>
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
            </select>
            <p className={styles.fieldHint} id={`${formId}-scheme-hint`}>协议要与服务实际监听方式一致。</p>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.host)}>
            <label htmlFor={`${formId}-host`}>主机地址<span className={styles.required}>必填</span></label>
            <input id={`${formId}-host`} value={form.host} onChange={(e) => set("host", e.target.value)} required aria-invalid={Boolean(fieldErrors.host)} aria-describedby={`${formId}-host-hint${fieldErrors.host ? ` ${formId}-host-error` : ""}`} placeholder="例如：127.0.0.1、localhost、10.0.0.12" />
            {fieldErrors.host ? <p className={styles.fieldError} id={`${formId}-host-error`}>{fieldErrors.host}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-host-hint`}>使用 cloudflared 所在机器能够直接访问到的目标地址。</p>
          </div>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.port)}>
            <label htmlFor={`${formId}-port`}>端口<span className={styles.required}>必填</span></label>
            <input id={`${formId}-port`} type="number" value={form.port} onChange={(e) => set("port", e.target.value)} required min={1} max={65535} aria-invalid={Boolean(fieldErrors.port)} aria-describedby={`${formId}-port-hint${fieldErrors.port ? ` ${formId}-port-error` : ""}`} placeholder="例如：3000、8080、8443" />
            {fieldErrors.port ? <p className={styles.fieldError} id={`${formId}-port-error`}>{fieldErrors.port}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-port-hint`}>端口范围必须在 1 到 65535 之间。</p>
          </div>
        </div>
      </section>
      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h3>健康检查</h3>
          <p>建议保持一个轻量且稳定的路径，便于快速判定服务状态。</p>
        </div>
        <div className={styles.field} data-invalid={Boolean(fieldErrors.healthCheckPath)}>
          <div className={styles.fieldHeader}>
            <label htmlFor={`${formId}-health`}>健康检查路径</label>
            <span className={styles.optional}>可选</span>
          </div>
          <input id={`${formId}-health`} value={form.healthCheckPath} onChange={(e) => set("healthCheckPath", e.target.value)} placeholder="例如：/health、/ready、/" aria-invalid={Boolean(fieldErrors.healthCheckPath)} aria-describedby={`${formId}-health-hint${fieldErrors.healthCheckPath ? ` ${formId}-health-error` : ""}`} />
          {fieldErrors.healthCheckPath ? <p className={styles.fieldError} id={`${formId}-health-error`}>{fieldErrors.healthCheckPath}</p> : null}
          <p className={styles.fieldHint} id={`${formId}-health-hint`}>建议使用轻量、稳定且无需鉴权的探活路径。</p>
        </div>
      </section>
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
          <p className={styles.actionHint}>{hasBlockingErrors ? "请先补全必填项并修正格式问题。" : "保存后会立即影响该服务的绑定与健康检查。"}</p>
          <div className={styles.inlineButtons}>
            <button type="submit" className={styles.button} disabled={loading || hasBlockingErrors} aria-busy={loading}>
              {submitLabel}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={onDone} disabled={loading}>取消</button>
          </div>
        </div>
      </div>
    </form>
  );
}
