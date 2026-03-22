"use client";
import { useRouter } from "next/navigation";

import { parseJson } from "@/lib/client-api";
import { useState } from "react";
import styles from "./forms.module.css";

export function ServiceDiscoveryButton() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function onClick() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/services/discover", { method: "POST" });
      const env = await parseJson<{ importedCount?: number; discovered?: Array<unknown> }>(res);
      if (!env.ok) {
        throw new Error(env.error.message || "发现失败");
      }
      setMessage(`发现 ${env.data.discovered?.length ?? 0} 个候选服务，导入 ${env.data.importedCount ?? 0} 个`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发现失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.stack}>
      <button type="button" className={styles.secondaryButton} onClick={onClick} disabled={loading} aria-busy={loading}>
        {loading ? "发现中..." : "自动发现服务"}
      </button>
      {message ? <p className={`${styles.message} ${styles.info}`}>{message}</p> : null}
    </div>
  );
}
