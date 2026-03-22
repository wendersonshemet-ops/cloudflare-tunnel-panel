"use client";

import { AppShell } from "@/components/app-shell";
import { ResponsiveTable } from "@/components/responsive-table";
import { EmptyState, InlineSpinner, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { useEffect, useRef, useState } from "react";
import styles from "./logs.module.css";
import shellStyles from "../workbench.module.css";

type LogItem = {
  id: string;
  createdAt: string;
  resourceType: string;
  resourceId: string | null;
  action: string;
  level: string;
  message: string;
  details: string | null;
};

type LevelFilter = "all" | "info" | "warning" | "error";

export default function LogsPage() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchLogs() {
    try {
      const res = await fetch("/api/logs?limit=100");
      const data = await res.json();
      if (data?.ok) {
        setItems(data.data.items);
        setLastUpdated(new Date());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
    intervalRef.current = setInterval(fetchLogs, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const filtered = levelFilter === "all" ? items : items.filter((i) => i.level === levelFilter);

  return (
    <AppShell>
      <div className={shellStyles.pageStack}>
        <PageHeader
          title="操作日志"
          description="统一查看同步、发布、检测和异常事件，用于排障、审计和回溯。每 10 秒自动刷新一次。"
        />

        <Panel
          title={`最近事件（共 ${filtered.length} 条）`}
          extra={
            <div className={styles.toolbar}>
              <select
                className={styles.filterSelect}
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
                aria-label="日志级别过滤"
              >
                <option value="all">全部级别</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
              <button type="button" className={styles.refreshBtn} onClick={fetchLogs} disabled={loading}>
                {loading ? "刷新中..." : "刷新"}
              </button>
              {loading ? <InlineSpinner label="读取日志中" /> : null}
              {lastUpdated && !loading ? (
                <span className={styles.updateTime}>
                  更新于 {lastUpdated.toLocaleTimeString("zh-CN")}
                </span>
              ) : null}
            </div>
          }
        >
          {loading ? (
            <div className={styles.loadingGrid} aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className={styles.loadingRow} />
              ))}
            </div>
          ) : (
            <ResponsiveTable
              columns={[
                { key: "createdAt", label: "时间", width: 190, priority: "high" },
                { key: "resource", label: "资源", width: 180, priority: "high" },
                { key: "action", label: "动作", width: 150, priority: "medium" },
                { key: "level", label: "级别", width: 110, priority: "high" },
                { key: "message", label: "消息", priority: "high" },
              ]}
              rows={filtered.map((item) => ({
                key: item.id,
                cells: {
                  createdAt: <span className={styles.monoText}>{item.createdAt}</span>,
                  resource: (
                    <div className={styles.resourceCell}>
                      <strong>{item.resourceType}</strong>
                      <div className={styles.resourceMeta}>{item.resourceId ?? "-"}</div>
                    </div>
                  ),
                  action: <code className={styles.code}>{item.action}</code>,
                  level: <StatusBadge state={item.level as "healthy" | "warning" | "error"} />,
                  message: item.message,
                },
              }))}
              empty={<EmptyState icon="logs" title="暂无日志" message="还没有可展示的操作记录。" hint="执行一次同步、检测或发布后，这里会自动出现最新事件。" />}
            />
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
