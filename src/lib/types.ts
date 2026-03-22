export type HealthState = "healthy" | "warning" | "error" | "unknown";

export type SyncHealth = "idle" | "healthy" | "warning" | "error";

export type CloudflaredApplyStrategy = "remote-api" | "none";

export type CloudflaredTrigger =
  | "manual"
  | "binding-create"
  | "binding-update"
  | "binding-delete";

export type TunnelSelectionStrategy = "manual" | "first-available" | "least-bindings" | "zone-affinity";

export type SyncStatus = {
  resource: "cloudflare";
  state: SyncHealth;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastSuccessAt: string | null;
  zoneCount: number;
  tunnelCount: number;
  dnsRecordCount: number;
  errorDetail: string | null;
};

export type Zone = {
  id: string;
  name: string;
  status: "active" | "pending" | "error";
  boundCount: number;
  tunnelStatus: "online" | "offline" | "degraded";
  syncedAt: string;
};

export type Tunnel = {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded";
  connectorCount: number;
  configPath: string;
  syncedAt: string;
};

export type DnsRecord = {
  id: string;
  zoneId: string;
  bindingId: string | null;
  hostname: string;
  type: "CNAME";
  content: string;
  proxied: boolean;
  status: HealthState;
  source: "cloudflare" | "panel";
  lastError: string | null;
  syncedAt: string;
};

export type CloudflaredApplyResult = {
  attempted: boolean;
  strategy: CloudflaredApplyStrategy;
  ok: boolean;
  message: string;
  checkedAt: string;
  configPath: string | null;
  serviceState: "running" | "stopped" | "unknown";
  serviceMessage: string;
  serviceCheck: CloudflaredServiceCheckResult;
};

export type CloudflaredServiceCheckResult = {
  checkedAt: string;
  source: "cloudflare" | "public-check" | "unavailable";
  state: "running" | "stopped" | "unknown";
  message: string;
};

export type CloudflaredValidationResult = {
  ok: boolean;
  checkedAt: string;
  configPath: string;
  message: string;
  stdout: string;
  stderr: string;
  error: string | null;
};

export type CloudflaredConfigVerificationResult = {
  ok: boolean;
  checkedAt: string;
  configPath: string;
  expectedHash: string;
  actualHash: string | null;
  message: string;
  error: string | null;
};

export type CloudflaredDeploymentResult = {
  trigger: CloudflaredTrigger;
  tunnelId: string;
  tunnelName: string;
  ingressCount: number;
  wroteConfig: boolean;
  rolledBack: boolean;
  outputPath: string;
  stagedPath: string;
  backupPath: string | null;
  configHash: string;
  createdAt: string;
  validation: CloudflaredValidationResult;
  verification: {
    afterCommit: CloudflaredConfigVerificationResult;
    afterApply: CloudflaredConfigVerificationResult;
  };
  apply: CloudflaredApplyResult;
  status: CloudflaredDeploymentStatus;
};

export type CloudflaredDeploymentStatus = {
  level: HealthState;
  phase: "validated" | "validation_failed" | "apply_failed" | "applied" | "rolled_back";
  configState: "verified" | "mismatch" | "rolled-back" | "unknown";
  serviceState: CloudflaredApplyResult["serviceState"];
  summary: string;
  checkedAt: string;
};

export type LocalServiceSource = "manual" | "docker" | "systemd" | "process";

export type LocalService = {
  id: string;
  name: string;
  scheme: "http" | "https";
  host: string;
  port: number;
  healthCheckPath: string;
  source: LocalServiceSource;
  healthy: boolean;
  statusCode: number | null;
  boundHostname: string | null;
  updatedAt: string;
};

export type Binding = {
  id: string;
  zoneId: string;
  zoneName: string;
  hostname: string;
  serviceId: string;
  serviceName: string;
  serviceTarget: string;
  tunnelId: string;
  tunnelName: string;
  dnsStatus: HealthState;
  dnsRecordId: string | null;
  dnsRecordContent: string | null;
  tunnelStatus: HealthState;
  accessStatus: HealthState;
  localStatus: HealthState;
  checkedAt: string;
  updatedAt: string;
};

export type DashboardSummary = {
  zoneCount: number;
  serviceCount: number;
  bindingCount: number;
  incidentCount: number;
  tunnelOnlineCount: number;
  tunnelTotalCount: number;
};

export type BindingPreflightResult = {
  ok: boolean;
  hostnameAvailable: boolean;
  existingBindingId: string | null;
  chosenTunnel: Tunnel | null;
  strategy: TunnelSelectionStrategy;
  conflicts: string[];
  warnings: string[];
};

export type OperationLogLevel = "info" | "warning" | "error";

export type OperationLog = {
  id: string;
  resourceType: string;
  resourceId: string | null;
  action: string;
  level: OperationLogLevel;
  message: string;
  details: string | null;
  createdAt: string;
};

export type AppState = {
  zones: Zone[];
  tunnels: Tunnel[];
  services: LocalService[];
  bindings: Binding[];
};
