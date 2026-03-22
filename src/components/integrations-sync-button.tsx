"use client";
import { useRouter } from "next/navigation";

import { parseJson } from "@/lib/client-api";
import { useState } from "react";
import { useToast } from "@/components/toast";
import styles from "./forms.module.css";

export function IntegrationsSyncButton() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations?refresh=1", { method: "GET" });
      const env = await parseJson<{ syncStatus?: { message?: string } }>(res);
      if (!env.ok) throw new Error(env.error.message || "同步失败");
      toast(env.data.syncStatus?.message || "同步完成", "success");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "同步失败", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={styles.button} onClick={onClick} disabled={loading} aria-busy={loading}>
      {loading ? "同步中..." : "同步 Cloudflare"}
    </button>
  );
}
