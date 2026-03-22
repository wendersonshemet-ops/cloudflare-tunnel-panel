"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import { useToast } from "@/components/toast";
import { ServiceCheckButton } from "@/components/service-check-button";
import { ServiceEditForm } from "@/components/service-edit-form";
import { EmptyState, StatusBadge } from "@/components/ui";
import { ResponsiveTable } from "@/components/responsive-table";
import { LocalService } from "@/lib/types";
import styles from "./forms.module.css";

export function ServiceList({ services }: { services: LocalService[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteService(id: string, name: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error?.message || "删除失败");
      toast(`已删除服务：${name}`, "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "删除失败", "error");
      setDeletingId(null);
    }
  }

  if (services.length === 0) {
    return (
      <EmptyState
        icon="services"
        title="暂无本地服务"
        message="Cloudflare 同步不会自动推断本机服务，这里需要手动新增或通过自动发现导入候选服务。"
        hint="先填写上方表单，或点击“自动发现服务”批量导入。"
      />
    );
  }

  return (
    <ResponsiveTable
      columns={[
        { key: "name", label: "服务名", priority: "high" },
        { key: "address", label: "地址", priority: "high" },
        { key: "health", label: "健康状态", priority: "high" },
        { key: "binding", label: "已绑定", priority: "medium" },
        { key: "actions", label: "操作", priority: "high" },
      ]}
      rows={services.map((service) => ({
        key: service.id,
        cells: {
          name: editingId === service.id ? (
            <ServiceEditForm service={service} onDone={() => setEditingId(null)} />
          ) : (
            <div>
              <strong>{service.name}</strong>
              <div className={styles.subtleText}>来源：{service.source} · {service.scheme.toUpperCase()}</div>
            </div>
          ),
          address: editingId === service.id ? null : (
            <div>
              <span className={styles.monoText}>{service.host}:{service.port}</span>
              <div className={styles.subtleText}>{service.healthCheckPath}</div>
            </div>
          ),
          health: editingId === service.id ? null : (
            <div className={styles.statusRow}>
              <StatusBadge state={service.healthy ? "healthy" : "error"} />
              <span className={styles.subtleText}>HTTP {service.statusCode ?? "-"}</span>
            </div>
          ),
          binding: editingId === service.id ? null : (service.boundHostname ?? "未绑定"),
          actions: editingId === service.id ? null : (
            <div className={styles.inlineButtons}>
              <ServiceCheckButton serviceId={service.id} />
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setEditingId(service.id)}
              >编辑</button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={deletingId === service.id}
                onClick={() => {
                  if (window.confirm(`确认删除服务「${service.name}」？`)) {
                    deleteService(service.id, service.name);
                  }
                }}
              >{deletingId === service.id ? "删除中..." : "删除"}</button>
            </div>
          ),
        },
      }))}
    />
  );
}
