import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { ServiceDiscoveryButton } from "@/components/service-discovery-button";
import { ServiceForm } from "@/components/service-form";
import { ServiceList } from "@/components/service-list";
import { PageHeader, Panel } from "@/components/ui";
import { isPageAuthenticated } from "@/lib/guard";
import { listServices } from "@/lib/repository";
import styles from "../workbench.module.css";

export default async function ServicesPage() {
  const authenticated = await isPageAuthenticated();
  if (!authenticated) {
    return <LoginScreen initialNext="/services" />;
  }

  const services = listServices();

  return (
    <AppShell>
      <div className={styles.pageStack}>
        <PageHeader
          title="本地服务"
          description="维护被 Tunnel 暴露的本地服务清单，支持手动登记、自动发现和健康检查。"
          actions={<ServiceDiscoveryButton />}
        />

        <div className={styles.stack}>
          <Panel title="新增服务">
            <ServiceForm />
          </Panel>

          <Panel title="服务列表" extra={<span className={styles.pageHeaderMeta}>共 {services.length} 个</span>}>
            <ServiceList services={services} />
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
