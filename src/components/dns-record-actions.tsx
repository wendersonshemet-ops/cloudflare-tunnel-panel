"use client";
import { useRouter } from "next/navigation";

import { parseJson } from "@/lib/client-api";
import { DnsRecord } from "@/lib/types";
import { useState } from "react";
import styles from "./forms.module.css";

export function DnsRecordActions({ record }: { record: DnsRecord }) {
  const [busy, setBusy] = useState<"none" | "sync" | "detach">("none");
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function sync() {
    if (!record.bindingId) {
      setMessage("该记录未关联绑定，无法直接同步");
      return;
    }

    setBusy("sync");
    setMessage("");
    try {
      const res = await fetch(`/api/bindings/${record.bindingId}/dns`, { method: "POST" });
      const env = await parseJson<{ dns?: { action?: string } }>(res);
      if (!env.ok) {
        throw new Error(env.error.message);
      }
      setMessage(`已同步：${env.data.dns?.action || "ok"}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "同步失败");
    } finally {
      setBusy("none");
    }
  }

  async function detach() {
    if (!record.bindingId) {
      setMessage("该记录未关联绑定，无法解除关联");
      return;
    }

    setBusy("detach");
    setMessage("");
    try {
      const res = await fetch(`/api/bindings/${record.bindingId}/dns`, { method: "DELETE" });
      const env = await parseJson<{ deleted?: boolean }>(res);
      if (!env.ok) {
        throw new Error(env.error.message);
      }
      setMessage(env.data.deleted ? "DNS 记录已删除" : "已清空关联");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy("none");
    }
  }

  return (
    <div className={styles.stack}>
      <div className={styles.inlineButtons}>
        <button type="button" className={styles.secondaryButton} onClick={sync} disabled={busy !== "none" || !record.bindingId}>
          {busy === "sync" ? "同步中..." : "同步"}
        </button>
        <button type="button" className={styles.dangerButton} onClick={detach} disabled={busy !== "none" || !record.bindingId}>
          {busy === "detach" ? "删除中..." : "删除/解绑"}
        </button>
      </div>
      {message ? <p className={`${styles.message} ${styles.info}`}>{message}</p> : null}
    </div>
  );
}
