export type IntegrationId =
  | "gmail"
  | "google_calendar"
  | "google_drive"
  | "azure_devops"
  | "n8n";

export type IntegrationHealthStatus = "ok" | "warning" | "error" | "disabled";

export type IntegrationLogLevel = "debug" | "info" | "warn" | "error";

export type IntegrationLogMetadata = Record<string, string | number | boolean | null>;

export type IntegrationCheckResult = {
  status: IntegrationHealthStatus;
  message: string;
  details?: string[];
  latencyMs?: number;
};

export type IntegrationSnapshot = IntegrationCheckResult & {
  id: IntegrationId;
  label: string;
  capabilities: string[];
  checkedAt: string;
  latencyMs: number;
};

export type IntegrationAdapter = {
  id: IntegrationId;
  label: string;
  capabilities: string[];
  checkHealth: () => Promise<IntegrationCheckResult>;
};

export type IntegrationLogEntry = {
  id: string;
  timestamp: string;
  integrationId: IntegrationId | "system";
  level: IntegrationLogLevel;
  message: string;
  metadata?: IntegrationLogMetadata;
};

export type IntegrationMonitorEntry = {
  id: IntegrationId;
  lastStatus: IntegrationHealthStatus;
  lastCheckedAt: string;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  averageLatencyMs: number;
  sampleCount: number;
  lastError: string | null;
};

