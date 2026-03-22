import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { ResponsiveTable } from "@/components/responsive-table";
import { SettingsForm } from "@/components/settings-form";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { getDeploymentTargets } from "@/lib/deploy-targets";
import { isPageAuthenticated } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import styles from "../workbench.module.css";

export default async function SettingsPage() {
  const authenticated = await isPageAuthenticated();
  if (!authenticated) {
    return <LoginScreen initialNext="/settings" />;
  }

  const settings = getSettings();
  const deployTargets = getDeploymentTargets();

  return (
    <AppShell>
      <div className={styles.pageStack}>
        <PageHeader
          title="Settings"
          description="Remote-docker-only runtime settings for Cloudflare API access, tunnel publishing behavior, optional discovery, and panel authentication."
        />

        <div className={styles.layout}>
          <Panel title="System Settings">
            <SettingsForm initial={settings} />
          </Panel>

          <div className={styles.stack}>
            <Panel title="Current Effective Settings">
              <ResponsiveTable
                columns={[
                  { key: "key", label: "Setting", priority: "high" },
                  { key: "value", label: "Value", priority: "high" },
                ]}
                rows={Object.entries(settings).map(([key, value]) => ({
                  key,
                  cells: {
                    key: <strong>{key}</strong>,
                    value: key.toLowerCase().includes("token") || key.toLowerCase().includes("password")
                      ? (value ? "******" : "Not set")
                      : value || "Not set",
                  },
                }))}
                empty={<EmptyState icon="settings" title="No settings" message="No effective settings are available yet." hint="Save the form once to persist the runtime configuration." />}
              />
            </Panel>

            <Panel title="Deployment Facts">
              <ResponsiveTable
                columns={[
                  { key: "key", label: "Item", priority: "high" },
                  { key: "value", label: "Value", priority: "high" },
                ]}
                rows={Object.entries(deployTargets).map(([key, value]) => ({
                  key,
                  cells: {
                    key: <strong>{key}</strong>,
                    value: String(value),
                  },
                }))}
                empty={<EmptyState icon="settings" title="No deployment facts" message="Deployment facts are not available." />}
              />
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
