"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import styles from "./forms.module.css";

export function CloudflaredServiceControls() {
  const [loading, setLoading] = useState<"" | "start" | "stop">("");
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function run(action: "start" | "stop") {
    setLoading(action);
    setMessage("");
    try {
      const res = await fetch("/api/cloudflared/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "操作失败");
      setMessage(json.data.message || `${action} 完成`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setLoading("");
    }
  }

  return (
    <div className={styles.feedbackStack}>
      <div className={styles.inlineButtons}>
        <button type="button" className={styles.secondaryButton} onClick={() => run("start")} disabled={Boolean(loading)} aria-busy={loading === "start"}>
          {loading === "start" ? "启动中..." : "启动 cloudflared"}
        </button>
        <button type="button" className={styles.dangerButton} onClick={() => run("stop")} disabled={Boolean(loading)} aria-busy={loading === "stop"}>
          {loading === "stop" ? "停止中..." : "停止 cloudflared"}
        </button>
      </div>
      {message ? <p className={`${styles.message} ${styles.info} ${styles.floatingMessage}`}>{message}</p> : null}
    </div>
  );
}
