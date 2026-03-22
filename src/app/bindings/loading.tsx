import { AppShell } from "@/components/app-shell";
import { LoadingPanel, PageHeader } from "@/components/ui";
import styles from "../workbench.module.css";

export default function BindingsLoading() {
  return (
    <AppShell>
      <PageHeader
        title="绑定管理"
        description="正在加载 Zone、Tunnel、绑定记录与 DNS 状态。"
      />
      <div className={styles.stack}>
        <LoadingPanel title="新建绑定" lines={4} />
        <LoadingPanel title="绑定列表" lines={5} />
        <LoadingPanel title="Ingress 配置预览" lines={4} />
        <LoadingPanel title="DNS 记录清单" lines={5} />
      </div>
    </AppShell>
  );
}
