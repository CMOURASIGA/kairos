import { IntegrationHealthStatus, IntegrationId, IntegrationMonitorEntry } from "@/services/integrations/types";

const monitorStore = new Map<IntegrationId, IntegrationMonitorEntry>();

export function recordIntegrationCheck(params: {
  id: IntegrationId;
  status: IntegrationHealthStatus;
  checkedAt: string;
  latencyMs: number;
  errorMessage?: string | null;
}): IntegrationMonitorEntry {
  const current = monitorStore.get(params.id);

  const sampleCount = (current?.sampleCount ?? 0) + 1;
  const previousAverage = current?.averageLatencyMs ?? params.latencyMs;
  const averageLatencyMs =
    current == null
      ? params.latencyMs
      : Math.round(((previousAverage * (sampleCount - 1)) + params.latencyMs) / sampleCount);

  const isFailure = params.status === "error";
  const consecutiveFailures = isFailure ? (current?.consecutiveFailures ?? 0) + 1 : 0;
  const lastSuccessAt =
    params.status === "ok"
      ? params.checkedAt
      : current?.lastSuccessAt ?? null;

  const entry: IntegrationMonitorEntry = {
    id: params.id,
    lastStatus: params.status,
    lastCheckedAt: params.checkedAt,
    lastSuccessAt,
    consecutiveFailures,
    averageLatencyMs,
    sampleCount,
    lastError: isFailure ? (params.errorMessage ?? "Erro nao especificado") : null,
  };

  monitorStore.set(params.id, entry);
  return entry;
}

export function listIntegrationMonitor(): IntegrationMonitorEntry[] {
  return Array.from(monitorStore.values()).sort((a, b) => a.id.localeCompare(b.id));
}

