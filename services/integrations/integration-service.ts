import { listIntegrationLogs, logIntegrationEvent } from "@/services/integrations/logger";
import { listIntegrationMonitor, recordIntegrationCheck } from "@/services/integrations/monitor";
import { listIntegrationAdapters } from "@/services/integrations/registry";
import { IntegrationHealthStatus, IntegrationSnapshot } from "@/services/integrations/types";

type IntegrationSummary = Record<IntegrationHealthStatus, number>;

export type IntegrationHealthReport = {
  generatedAt: string;
  summary: IntegrationSummary;
  integrations: IntegrationSnapshot[];
  monitor: ReturnType<typeof listIntegrationMonitor>;
  logs: ReturnType<typeof listIntegrationLogs>;
};

function emptySummary(): IntegrationSummary {
  return {
    ok: 0,
    warning: 0,
    error: 0,
    disabled: 0,
  };
}

function levelFromStatus(status: IntegrationHealthStatus): "info" | "warn" | "error" {
  if (status === "error") return "error";
  if (status === "warning" || status === "disabled") return "warn";
  return "info";
}

export async function getIntegrationHealthReport(options?: { logLimit?: number }): Promise<IntegrationHealthReport> {
  const adapters = listIntegrationAdapters();
  const snapshots: IntegrationSnapshot[] = [];
  const summary = emptySummary();

  for (const adapter of adapters) {
    const startedAt = Date.now();
    let status: IntegrationHealthStatus = "error";
    let message = "Falha ao executar healthcheck da integracao.";
    let details: string[] | undefined;
    let errorMessage: string | null = null;
    let latencyMs = 0;

    try {
      const result = await adapter.checkHealth();
      status = result.status;
      message = result.message;
      details = result.details;
      latencyMs = result.latencyMs ?? Math.max(1, Date.now() - startedAt);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Erro nao identificado";
      latencyMs = Math.max(1, Date.now() - startedAt);
      details = [errorMessage];
    }

    const checkedAt = new Date().toISOString();
    const snapshot: IntegrationSnapshot = {
      id: adapter.id,
      label: adapter.label,
      capabilities: adapter.capabilities,
      status,
      message,
      details,
      checkedAt,
      latencyMs,
    };

    snapshots.push(snapshot);
    summary[status] += 1;

    recordIntegrationCheck({
      id: adapter.id,
      status,
      checkedAt,
      latencyMs,
      errorMessage,
    });

    logIntegrationEvent({
      integrationId: adapter.id,
      level: levelFromStatus(status),
      message,
      metadata: {
        status,
        latencyMs,
      },
    });
  }

  logIntegrationEvent({
    integrationId: "system",
    level: "info",
    message: "Healthcheck de integracoes finalizado.",
    metadata: {
      total: snapshots.length,
      ok: summary.ok,
      warning: summary.warning,
      error: summary.error,
      disabled: summary.disabled,
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    summary,
    integrations: snapshots,
    monitor: listIntegrationMonitor(),
    logs: listIntegrationLogs(options?.logLimit ?? 30),
  };
}

