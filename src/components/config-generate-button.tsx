"use client";
import { useRouter } from "next/navigation";

import { parseJson } from "@/lib/client-api";
import { useState } from "react";
import styles from "./forms.module.css";

export function ConfigGenerateButton() {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/cloudflared", { method: "POST" });
      const env = await parseJson<{
        outputPath: string;
        validation?: { ok?: boolean; message?: string };
        apply?: { ok?: boolean; message?: string; strategy?: string; serviceState?: string };
        deployment?: { rolledBack?: boolean; verification?: { afterApply?: { ok?: boolean; message?: string } } };
        status?: { summary?: string; level?: string };
      }>(res);
      if (!env.ok) {
        throw new Error(env.error.message || "生成失败");
      }
      if (!env.data.validation?.ok) {
        setMessage(`校验失败：${env.data.validation?.message || "未知错误"}`);
      } else if (env.data.apply?.ok) {
        setMessage(
          env.data.status?.summary ||
            `已应用：${env.data.apply.strategy || "none"} -> ${env.data.apply.serviceState || "unknown"} / ${
              env.data.deployment?.verification?.afterApply?.ok ? "配置已确认" : "待确认"
            }`,
        );
      } else {
        setMessage(
          env.data.status?.summary ||
            `应用失败：${env.data.apply?.message || "未执行"}${env.data.deployment?.rolledBack ? "（已回滚）" : ""}`,
        );
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.stack}>
      <button type="button" className={styles.button} onClick={onClick} disabled={loading} aria-busy={loading}>
        {loading ? "应用中..." : "生成配置并应用"}
      </button>
      {message ? <p className={`${styles.message} ${styles.info}`}>{message}</p> : null}
    </div>
  );
}
