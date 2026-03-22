"use client";
import { useRouter } from "next/navigation";

import { parseJson } from "@/lib/client-api";
import { Binding, LocalService, Tunnel, Zone } from "@/lib/types";
import { useState } from "react";
import { BindingEditForm } from "./binding-edit-form";
import { useToast } from "@/components/toast";
import styles from "./forms.module.css";

export function BindingActions({ binding, zones, tunnels, services }: {
  binding: Binding;
  zones: Zone[];
  tunnels: Tunnel[];
  services: LocalService[];
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"none" | "checking" | "deleting" | "syncing-dns" | "removing-dns">("none");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteDns, setDeleteDns] = useState(false);

  async function check() {
    setBusy("checking");
    try {
      const res = await fetch(`/api/bindings/${binding.id}/check`, { method: "POST" });
      const env = await parseJson(res);
      if (!env.ok) throw new Error(env.error.message);
      toast("检测完成", "success");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "检测失败", "error");
    } finally {
      setBusy("none");
    }
  }

  async function remove() {
    setBusy("deleting");
    setConfirmDelete(false);
    try {
      const url = deleteDns
        ? `/api/bindings/${binding.id}?deleteDns=1`
        : `/api/bindings/${binding.id}`;
      const res = await fetch(url, { method: "DELETE" });
      const env = await parseJson(res);
      if (!env.ok) throw new Error(env.error.message);
      toast(deleteDns ? "绑定及 DNS 记录已删除" : "绑定已删除", "success");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "删除失败", "error");
    } finally {
      setBusy("none");
    }
  }

  async function syncDns() {
    setBusy("syncing-dns");
    try {
      const res = await fetch(`/api/bindings/${binding.id}/dns`, { method: "POST" });
      const env = await parseJson<{ dns?: { action?: string } }>(res);
      if (!env.ok) throw new Error(env.error.message);
      toast(`DNS 已同步：${env.data.dns?.action || "ok"}`, "success");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "DNS 同步失败", "error");
    } finally {
      setBusy("none");
    }
  }

  if (editing) {
    return <BindingEditForm binding={binding} zones={zones} tunnels={tunnels} services={services} onClose={() => setEditing(false)} />;
  }

  if (confirmDelete) {
    return (
      <div className={styles.confirmBox}>
        <p className={styles.confirmText}>确认删除绑定 <strong>{binding.hostname}</strong>？</p>
        {binding.dnsRecordId && (
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={deleteDns} onChange={(e) => setDeleteDns(e.target.checked)} />
            同时删除 Cloudflare DNS 记录
          </label>
        )}
        <div className={styles.inlineButtons}>
          <button type="button" className={styles.dangerButton} onClick={remove} disabled={busy !== "none"}>
            {busy === "deleting" ? "删除中..." : "确认删除"}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => setConfirmDelete(false)}>
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.inlineButtons}>
      <button type="button" className={styles.secondaryButton} onClick={() => setEditing(true)} disabled={busy !== "none"}>
        编辑
      </button>
      <button type="button" className={styles.secondaryButton} onClick={check} disabled={busy !== "none"}>
        {busy === "checking" ? "检测中..." : "检测"}
      </button>
      <button type="button" className={styles.secondaryButton} onClick={syncDns} disabled={busy !== "none"}>
        {busy === "syncing-dns" ? "同步 DNS..." : "同步 DNS"}
      </button>
      <button type="button" className={styles.dangerButton} onClick={() => setConfirmDelete(true)} disabled={busy !== "none"}>
        下线
      </button>
    </div>
  );
}
