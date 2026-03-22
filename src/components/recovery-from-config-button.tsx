"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import styles from "./forms.module.css";

export function RecoveryFromConfigButton() {
  const [loading, setLoading] = useState<"" | "preview" | "restore">("");
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function preview() {
    setLoading("preview");
    setMessage("");
    try {
      const res = await fetch("/api/recovery/config");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "预览失败");
      const items = json.data || [];
      const willCreate = items.filter((item: { status: string }) => item.status === "will-create").length;
      setMessage(`预览完成：共 ${items.length} 条，待恢复 ${willCreate} 条`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "预览失败");
    } finally {
      setLoading("");
    }
  }

  async function restore() {
    setLoading("restore");
    setMessage("");
    try {
      const res = await fetch("/api/recovery/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "恢复失败");
      setMessage(`恢复完成：新增 ${json.data.created?.length ?? 0} 条`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "恢复失败");
    } finally {
      setLoading("");
    }
  }

  return (
    <div className={styles.stack}>
      <div className={styles.inlineButtons}>
        <button type="button" className={styles.secondaryButton} onClick={preview} disabled={Boolean(loading)} aria-busy={loading === "preview"}>
          {loading === "preview" ? "预览中..." : "预览恢复"}
        </button>
        <button type="button" className={styles.button} onClick={restore} disabled={Boolean(loading)} aria-busy={loading === "restore"}>
          {loading === "restore" ? "恢复中..." : "从 config 恢复"}
        </button>
      </div>
      {message ? <p className={`${styles.message} ${styles.info}`}>{message}</p> : null}
    </div>
  );
}
