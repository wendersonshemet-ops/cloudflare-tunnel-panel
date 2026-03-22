"use client";

import { BindingPreflightResult } from "@/lib/types";
import { useState } from "react";
import styles from "./forms.module.css";

export function BindingPreflightButton({ payload }: { payload: {
  hostname: string;
  serviceId: string;
  zoneId: string;
  zoneName: string;
  tunnelId?: string;
} }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BindingPreflightResult | null>(null);
  const [error, setError] = useState("");
  const disabled = loading || !payload.hostname || !payload.serviceId || !payload.zoneId || !payload.zoneName;

  async function onClick() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bindings/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error?.message || "预检失败");
      }
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "预检失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.stack}>
      <button type="button" className={styles.secondaryButton} onClick={onClick} disabled={disabled} aria-busy={loading}>
        {loading ? "预检中..." : "执行发布预检"}
      </button>
      {disabled ? <p className={styles.actionHint}>预检前需要先补全 Zone、子域前缀和目标服务。</p> : null}
      {error ? <p className={`${styles.message} ${styles.error}`} role="alert">{error}</p> : null}
      {result ? (
        <div className={styles.preview}>
          <span className={styles.previewLabel}>预检结果</span>
          <div>发布结论：{result.ok ? "可以继续创建/保存" : "存在阻塞，请先处理"}</div>
          <div>选择策略：{result.strategy}</div>
          <div>推荐 Tunnel：{result.chosenTunnel?.name ?? "无"}</div>
          <div>冲突项：{result.conflicts.length ? result.conflicts.join("；") : "无"}</div>
          <div>提醒项：{result.warnings.length ? result.warnings.join("；") : "无"}</div>
        </div>
      ) : null}
    </div>
  );
}
