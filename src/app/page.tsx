import { AppShell } from "@/components/app-shell";
import { IntegrationsSyncButton } from "@/components/integrations-sync-button";
import { LoginScreen } from "@/components/login-screen";
import { OnlineBindingCards } from "@/components/online-binding-cards";
import { EmptyState, Panel } from "@/components/ui";
import { isPageAuthenticated } from "@/lib/guard";
import { listBindings } from "@/lib/repository";
import { getDashboardState } from "@/lib/state";
import styles from "./dashboard.module.css";

export default async function Home() {
  const authenticated = await isPageAuthenticated();
  if (!authenticated) {
    return <LoginScreen initialNext="/" />;
  }

  const { cloudflared } = await getDashboardState();
  const bindings = listBindings();
  const onlineBindings = bindings.filter(
    (binding) => binding.dnsStatus === "healthy" && binding.tunnelStatus === "healthy" && binding.accessStatus === "healthy"
  );

  const onlineBindingCards = onlineBindings.map((binding) => ({
    id: binding.id,
    hostname: binding.hostname,
    serviceName: binding.serviceName,
    internalTarget: binding.serviceTarget,
    publicUrl: `https://${binding.hostname}`,
    tunnelName: binding.tunnelName,
  }));

  return (
    <AppShell>
      <section className={styles.section}>
        <Panel title="页面入口" extra={<><span>共 {onlineBindings.length} 个</span><IntegrationsSyncButton /></>}>
          {cloudflared.runtimeConfig.status !== "healthy" && (
            <div className={styles.noticeInline}>
              <span className={styles.noticeInlineLabel}>配置未同步</span>
              <span className={styles.noticeInlineText}>{cloudflared.runtimeConfig.message}</span>
            </div>
          )}

          {onlineBindings.length > 0 ? (
            <OnlineBindingCards items={onlineBindingCards} />
          ) : (
            <EmptyState
              icon="binding"
              title="暂无已上线页面"
              message="当前没有 DNS、Tunnel、访问状态都健康的绑定。"
              hint="等绑定健康后，这里会自动出现可点击卡片。"
            />
          )}
        </Panel>
      </section>
    </AppShell>
  );
}
