import { AppShell } from "@/components/app-shell";
import { BindingActions } from "@/components/binding-actions";
import { BindingForm } from "@/components/binding-form";
import { DnsRecordActions } from "@/components/dns-record-actions";
import { IntegrationsSyncButton } from "@/components/integrations-sync-button";
import { LoginScreen } from "@/components/login-screen";
import { ResponsiveTable } from "@/components/responsive-table";
import { EmptyHint, EmptyState, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { isPageAuthenticated } from "@/lib/guard";
import { listBindings, listServices } from "@/lib/repository";
import { getDashboardState, listTunnelsState, listZonesState } from "@/lib/state";
import styles from "../workbench.module.css";

function summarizeBindingState(binding: { dnsStatus: string; tunnelStatus: string; accessStatus: string }) {
  const states = [binding.dnsStatus, binding.tunnelStatus, binding.accessStatus];
  if (states.includes("error")) return "error" as const;
  if (states.includes("warning")) return "warning" as const;
  if (states.includes("unknown")) return "unknown" as const;
  return "healthy" as const;
}

function formatList(values: string[] | undefined, empty: string) {
  if (!values || values.length === 0) {
    return empty;
  }
  return values.join(", ");
}

export default async function BindingsPage() {
  const authenticated = await isPageAuthenticated();
  if (!authenticated) {
    return <LoginScreen initialNext="/bindings" />;
  }

  const bindings = listBindings();
  const services = listServices();
  const dashboard = await getDashboardState();
  const [zones, tunnels] = await Promise.all([listZonesState(), listTunnelsState()]);
  const lastDeployment = dashboard.cloudflared.lastDeployment;
  const deploymentStatus = dashboard.cloudflared.status;
  const runtimeConfig = dashboard.cloudflared.runtimeConfig;
  const totalConnectorCount = tunnels.reduce((sum, tunnel) => sum + tunnel.connectorCount, 0);
  const diffSummary = runtimeConfig.diffSummary;

  return (
    <AppShell>
      <div className={styles.pageStack}>
        <PageHeader
          title="Bindings"
          description="Manage hostname-to-service bindings. CTP publishes ingress to Cloudflare and observes connector health remotely, but it does not control the cloudflared container."
          actions={
            <div className={styles.headerActions}>
              <IntegrationsSyncButton />
            </div>
          }
        />

        <div className={styles.stack}>
          <Panel title="Create Binding">
            <BindingForm zones={zones} tunnels={tunnels} services={services} />
          </Panel>

          <Panel title="Binding List" extra={<span className={styles.pageHeaderMeta}>{bindings.length} total</span>}>
            <ResponsiveTable
              columns={[
                { key: "hostname", label: "Hostname", priority: "high" },
                { key: "service", label: "Origin Service", priority: "high" },
                { key: "tunnel", label: "Tunnel", priority: "medium" },
                { key: "status", label: "Status", priority: "high" },
                { key: "actions", label: "Actions", priority: "high" },
              ]}
              rows={bindings.map((binding) => ({
                key: binding.id,
                cells: {
                  hostname: (
                    <div className={styles.tablePrimary}>
                      <strong>{binding.hostname}</strong>
                      <span className={styles.tableMeta}>{binding.zoneName}</span>
                    </div>
                  ),
                  service: (
                    <div className={styles.tablePrimary}>
                      <strong>{binding.serviceName}</strong>
                      <a
                        href={binding.serviceTarget}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.tableCode}
                        title={`Open ${binding.serviceTarget}`}
                      >
                        {binding.serviceTarget}
                      </a>
                    </div>
                  ),
                  tunnel: (
                    <div className={styles.tablePrimary}>
                      <strong>{binding.tunnelName || "-"}</strong>
                      <span className={styles.tableMeta}>{binding.tunnelId}</span>
                    </div>
                  ),
                  status: <StatusBadge state={summarizeBindingState(binding)} />,
                  actions: <BindingActions binding={binding} zones={zones} tunnels={tunnels} services={services} />,
                },
              }))}
              empty={<EmptyHint title="No bindings yet" text="There are no public hostname mappings yet." action="Create the first binding above to publish a service through your selected Cloudflare tunnel." />}
            />
          </Panel>

          <Panel title="Remote Tunnel Status">
            <div className={styles.deployMeta}>
              <div>
                <span>Connector Summary</span>
                <strong>{dashboard.cloudflared.info.message}</strong>
              </div>
              <div>
                <span>Total Connectors</span>
                <strong>{totalConnectorCount}</strong>
              </div>
              <div>
                <span>Last Remote Publish</span>
                <strong>{deploymentStatus?.summary ?? "No remote publish has been recorded yet."}</strong>
              </div>
              <div>
                <span>Last Publish Time</span>
                <strong>{dashboard.cloudflared.lastApply?.checkedAt ?? "Never"}</strong>
              </div>
              <div>
                <span>Remote Ingress Drift</span>
                <strong>{runtimeConfig.message}</strong>
              </div>
              <div>
                <span>Lifecycle Control</span>
                <strong>Externally managed by Docker</strong>
              </div>
            </div>
            <div className={styles.deployMeta}>
              <div>
                <span>Missing Hostnames</span>
                <strong>{formatList(diffSummary?.missingHostnames, "None")}</strong>
              </div>
              <div>
                <span>Extra Hostnames</span>
                <strong>{formatList(diffSummary?.extraHostnames, "None")}</strong>
              </div>
              <div>
                <span>Service Mismatches</span>
                <strong>
                  {diffSummary?.mismatchedServices?.length
                    ? diffSummary.mismatchedServices.map((item) => `${item.hostname}: ${item.actual}`).join(" | ")
                    : "None"}
                </strong>
              </div>
              <div>
                <span>Remote Publish Path</span>
                <strong>{lastDeployment?.outputPath ?? "remote-cloudflare"}</strong>
              </div>
            </div>
          </Panel>

          <Panel title="Tunnel Connectors" extra={<span className={styles.pageHeaderMeta}>{tunnels.length} tunnel(s)</span>}>
            <ResponsiveTable
              columns={[
                { key: "tunnel", label: "Tunnel", priority: "high" },
                { key: "connectors", label: "Connectors", priority: "high" },
                { key: "status", label: "Status", priority: "high" },
                { key: "syncedAt", label: "Synced At", priority: "medium" },
              ]}
              rows={tunnels.map((tunnel) => ({
                key: tunnel.id,
                cells: {
                  tunnel: (
                    <div className={styles.tablePrimary}>
                      <strong>{tunnel.name}</strong>
                      <span className={styles.tableMeta}>{tunnel.id}</span>
                    </div>
                  ),
                  connectors: tunnel.connectorCount,
                  status: <StatusBadge state={tunnel.status} />,
                  syncedAt: <span className={styles.tableMeta}>{tunnel.syncedAt}</span>,
                },
              }))}
              empty={<EmptyState icon="binding" title="No tunnels available" message="No Cloudflare tunnel is currently available to the panel." hint="Run a Cloudflare sync after configuring the API token and account ID." />}
            />
          </Panel>

          <Panel title="DNS Records" extra={<span className={styles.pageHeaderMeta}>{dashboard.dnsRecords.length} total</span>}>
            <ResponsiveTable
              columns={[
                { key: "hostname", label: "Hostname", priority: "high" },
                { key: "content", label: "Content", priority: "high" },
                { key: "source", label: "Source", priority: "medium" },
                { key: "status", label: "Status", priority: "high" },
                { key: "syncedAt", label: "Synced At", priority: "medium" },
                { key: "actions", label: "Actions", priority: "high" },
              ]}
              rows={dashboard.dnsRecords.map((record) => ({
                key: record.id,
                cells: {
                  hostname: (
                    <div className={styles.tablePrimary}>
                      <strong>{record.hostname}</strong>
                      <span className={styles.tableMeta}>{record.id}</span>
                    </div>
                  ),
                  content: record.content,
                  source: record.source,
                  status: <StatusBadge state={record.proxied ? "healthy" : "warning"} />,
                  syncedAt: <span className={styles.tableMeta}>{record.syncedAt}</span>,
                  actions: <DnsRecordActions record={record} />,
                },
              }))}
              empty={<EmptyState icon="binding" title="No DNS records" message="DNS records will appear here after a Cloudflare sync or after bindings are published." hint="Create a binding first, then publish or sync DNS." />}
            />
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
