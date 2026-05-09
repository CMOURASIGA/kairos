export { getIntegrationHealthReport } from "@/services/integrations/integration-service";
export { listIntegrationAdapters, registerIntegrationAdapter } from "@/services/integrations/registry";
export type {
  IntegrationAdapter,
  IntegrationCheckResult,
  IntegrationHealthStatus,
  IntegrationId,
  IntegrationLogEntry,
  IntegrationMonitorEntry,
  IntegrationSnapshot,
} from "@/services/integrations/types";

