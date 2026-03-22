import styles from "./ui.module.css";
import { ReactNode } from "react";
import { Activity, AlertTriangle, CheckCircle2, FolderKanban, Globe2, HelpCircle, Inbox, Layers3, LoaderCircle, ServerCog, Settings2, Sparkles } from "lucide-react";
import { HealthState } from "@/lib/types";

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderText}>
        <span className={styles.eyebrow}>Cloudflare Tunnel Console</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}

const statIcons: Record<string, ReactNode> = {
  域名: <Globe2 size={18} />,
  服务: <ServerCog size={18} />,
  绑定: <CheckCircle2 size={18} />,
  异常: <AlertTriangle size={18} />,
};

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{statIcons[label] ?? <Activity size={18} />}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </div>
  );
}

export function Panel({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <h2>{title}</h2>
        </div>
        {extra ? <div className={styles.panelExtra}>{extra}</div> : null}
      </div>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

export function StatusBadge({ state }: { state: HealthState | "online" | "offline" | "degraded" }) {
  const textMap: Record<string, string> = {
    healthy: "正常",
    warning: "告警",
    error: "异常",
    unknown: "未知",
    online: "在线",
    offline: "离线",
    degraded: "降级",
  };

  const iconMap: Record<string, ReactNode> = {
    healthy: <CheckCircle2 size={12} />,
    online: <CheckCircle2 size={12} />,
    warning: <AlertTriangle size={12} />,
    degraded: <AlertTriangle size={12} />,
    error: <AlertTriangle size={12} />,
    offline: <AlertTriangle size={12} />,
    unknown: <HelpCircle size={12} />,
  };

  return <span className={`${styles.badge} ${styles[`badge_${state}`]}`}>{iconMap[state]}{textMap[state]}</span>;
}

export function Table({ children }: { children: ReactNode }) {
  return <div className={styles.tableWrap}><table className={styles.table}>{children}</table></div>;
}

export function EmptyHint({
  title = "暂无数据",
  text,
  action,
}: {
  title?: string;
  text: string;
  action?: string;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}><Inbox size={18} /></div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
        {action ? <span className={styles.emptyAction}>{action}</span> : null}
      </div>
    </div>
  );
}

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className={styles.loadingCards}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.loadingCard}>
          <div className={`${styles.shimmer} ${styles.loadingIcon}`} />
          <div className={`${styles.shimmer} ${styles.loadingLineShort}`} />
          <div className={`${styles.shimmer} ${styles.loadingLineLarge}`} />
          <div className={`${styles.shimmer} ${styles.loadingLineMedium}`} />
        </div>
      ))}
    </div>
  );
}

export function LoadingPanel({ title, lines = 4 }: { title: string; lines?: number }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <h2>{title}</h2>
        </div>
        <div className={`${styles.shimmer} ${styles.loadingChip}`} />
      </div>
      <div className={styles.loadingStack}>
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className={styles.loadingRow}>
            <div className={`${styles.shimmer} ${styles.loadingLineMedium}`} />
            <div className={`${styles.shimmer} ${styles.loadingLineLarge}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

const emptyIcons = {
  binding: <Layers3 size={18} />,
  dashboard: <Sparkles size={18} />,
  logs: <Inbox size={18} />,
  services: <FolderKanban size={18} />,
  settings: <Settings2 size={18} />,
};

export function EmptyState({
  icon = "logs",
  title,
  message,
  hint,
}: {
  icon?: keyof typeof emptyIcons;
  title: string;
  message: string;
  hint?: string;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>{emptyIcons[icon]}</div>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
        {hint ? <span className={styles.emptyAction}>{hint}</span> : null}
      </div>
    </div>
  );
}

export function InlineSpinner({ label = "加载中" }: { label?: string }) {
  return (
    <span className={styles.inlineSpinner} role="status" aria-live="polite">
      <LoaderCircle size={14} className={styles.spinnerIcon} />
      {label}
    </span>
  );
}
