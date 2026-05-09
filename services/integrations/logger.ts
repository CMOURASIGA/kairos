import { IntegrationId, IntegrationLogEntry, IntegrationLogLevel, IntegrationLogMetadata } from "@/services/integrations/types";

const MAX_LOGS = 500;
const integrationLogs: IntegrationLogEntry[] = [];

export function logIntegrationEvent(input: {
  integrationId: IntegrationId | "system";
  level: IntegrationLogLevel;
  message: string;
  metadata?: IntegrationLogMetadata;
}): IntegrationLogEntry {
  const entry: IntegrationLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    integrationId: input.integrationId,
    level: input.level,
    message: input.message,
    metadata: input.metadata,
  };

  integrationLogs.unshift(entry);
  if (integrationLogs.length > MAX_LOGS) {
    integrationLogs.length = MAX_LOGS;
  }

  const prefix = `[integration:${entry.integrationId}]`;
  if (entry.level === "error") {
    console.error(prefix, entry.message, entry.metadata ?? {});
  } else if (entry.level === "warn") {
    console.warn(prefix, entry.message, entry.metadata ?? {});
  } else {
    console.log(prefix, entry.message, entry.metadata ?? {});
  }

  return entry;
}

export function listIntegrationLogs(limit = 100): IntegrationLogEntry[] {
  const size = Math.max(1, Math.min(limit, MAX_LOGS));
  return integrationLogs.slice(0, size);
}

