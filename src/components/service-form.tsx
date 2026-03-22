"use client";
import { useRouter } from "next/navigation";

import { formatApiError } from "@/lib/client-api";
import { useId, useState } from "react";
import { useToast } from "@/components/toast";
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

  if (!form.name.trim()) {
    nextErrors.name = "请填写服务名，便于后续绑定时识别。";
  }

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

export function ServiceForm() {
  const { toast } = useToast();
  const router = useRouter();
  const formId = useId();
  const [form, setForm] = useState({
    name: "",
    scheme: "http",
    host: "127.0.0.1",
    port: "",
    healthCheckPath: "/",
    source: "manual",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; host?: string; port?: string; healthCheckPath?: string }>({});
  const liveErrors = validateServiceForm(form);
  const hasBlockingErrors = Object.keys(liveErrors).length > 0;
  const errorEntries = Object.entries(fieldErrors).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const submitLabel = loading ? "创建中..." : hasBlockingErrors ? `请先修正 ${Object.keys(liveErrors).length} 项` : "新增服务";

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    const nextForm = { ...form, [key]: value };
    setForm(nextForm);
    setFieldErrors(validateServiceForm(nextForm));
    if (error) setError("");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const nextErrors = validateServiceForm(form);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("请先修正表单中的字段问题。");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
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
      if (!data?.ok) throw new Error(data?.error?.message || "创建失败");
      toast(`已创建服务：${data.data.item.name}`, "success");
      setForm({ name: "", scheme: "http", host: "127.0.0.1", port: "", healthCheckPath: "/", source: "manual" });
      setFieldErrors({});
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
          <p>先定义服务名称和访问协议，后续绑定时会直接显示这些信息。</p>
        </div>
        <div className={styles.row}>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.name)}>
            <div className={styles.fieldHeader}>
              <label htmlFor={`${formId}-name`}>服务名<span className={styles.required}>必填</span></label>
            </div>
            <input id={`${formId}-name`} value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="例如：后台管理、API 网关、Grafana" required aria-invalid={Boolean(fieldErrors.name)} aria-describedby={`${formId}-name-hint${fieldErrors.name ? ` ${formId}-name-error` : ""}`} />
            {fieldErrors.name ? <p className={styles.fieldError} id={`${formId}-name-error`}>{fieldErrors.name}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-name-hint`}>建议使用业务可识别名称，避免后续绑定时混淆。</p>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${formId}-scheme`}>协议<span className={styles.required}>必填</span></label>
            <select id={`${formId}-scheme`} value={form.scheme} onChange={(e) => updateField("scheme", e.target.value as typeof form.scheme)} aria-label="服务协议" aria-describedby={`${formId}-scheme-hint`}>
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
            </select>
            <p className={styles.fieldHint} id={`${formId}-scheme-hint`}>协议需要和服务真实监听方式一致，否则健康检查和代理都可能失败。</p>
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h3>网络地址</h3>
          <p>这里定义 cloudflared 最终要转发到的本地目标。</p>
        </div>
        <div className={styles.row}>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.host)}>
            <label htmlFor={`${formId}-host`}>主机地址<span className={styles.required}>必填</span></label>
            <input id={`${formId}-host`} value={form.host} onChange={(e) => updateField("host", e.target.value)} placeholder="例如：127.0.0.1、localhost、10.0.0.12" aria-invalid={Boolean(fieldErrors.host)} aria-describedby={`${formId}-host-hint${fieldErrors.host ? ` ${formId}-host-error` : ""}`} />
            {fieldErrors.host ? <p className={styles.fieldError} id={`${formId}-host-error`}>{fieldErrors.host}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-host-hint`}>使用可被 cloudflared 访问到的地址，例如 `127.0.0.1`、`localhost` 或局域网 IP。</p>
          </div>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.port)}>
            <label htmlFor={`${formId}-port`}>端口<span className={styles.required}>必填</span></label>
            <input id={`${formId}-port`} type="number" min={1} max={65535} value={form.port} onChange={(e) => updateField("port", e.target.value)} placeholder="例如：3000、8080、8443" required aria-invalid={Boolean(fieldErrors.port)} aria-describedby={`${formId}-port-hint${fieldErrors.port ? ` ${formId}-port-error` : ""}`} />
            {fieldErrors.port ? <p className={styles.fieldError} id={`${formId}-port-error`}>{fieldErrors.port}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-port-hint`}>端口范围必须在 1 到 65535 之间。</p>
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h3>监控与来源</h3>
          <p>健康检查路径用于状态检测，来源字段用于说明该服务是如何被录入的。</p>
        </div>
        <div className={styles.row}>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.healthCheckPath)}>
            <div className={styles.fieldHeader}>
              <label htmlFor={`${formId}-health`}>健康检查路径</label>
              <span className={styles.optional}>可选</span>
            </div>
            <input id={`${formId}-health`} value={form.healthCheckPath} onChange={(e) => updateField("healthCheckPath", e.target.value)} placeholder="例如：/health、/ready、/" aria-invalid={Boolean(fieldErrors.healthCheckPath)} aria-describedby={`${formId}-health-hint${fieldErrors.healthCheckPath ? ` ${formId}-health-error` : ""}`} />
            {fieldErrors.healthCheckPath ? <p className={styles.fieldError} id={`${formId}-health-error`}>{fieldErrors.healthCheckPath}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-health-hint`}>建议填写轻量且稳定的路径，未特别区分时可保持 `/`。</p>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${formId}-source`}>来源<span className={styles.required}>必填</span></label>
            <select id={`${formId}-source`} value={form.source} onChange={(e) => updateField("source", e.target.value as typeof form.source)} aria-describedby={`${formId}-source-hint`}>
              <option value="manual">手动录入</option>
              <option value="docker">Docker</option>
              <option value="systemd">systemd</option>
              <option value="process">进程扫描</option>
            </select>
            <p className={styles.fieldHint} id={`${formId}-source-hint`}>如果服务来自手动维护，保持“手动录入”即可。</p>
          </div>
        </div>
      </section>

      <p className={`${styles.helper} ${styles.helperCard}`}>新服务会直接入库；如果后续接入自动发现或健康检测，这里仍然是主编辑入口。</p>
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
          <p className={styles.actionHint}>{hasBlockingErrors ? "请先补全必填项并修正格式问题。" : "确认后会立即写入本地服务清单。"}</p>
          <div className={styles.fieldMetaActions}>
            <button className={styles.button} disabled={loading || hasBlockingErrors} type="submit" aria-busy={loading}>
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
