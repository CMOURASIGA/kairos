import { logIntegrationEvent } from "@/services/integrations/logger";
import { IntegrationCheckResult } from "@/services/integrations/types";

const DEFAULT_WORKFLOWS_LIMIT = 20;
const MAX_WORKFLOWS_LIMIT = 100;
const DEFAULT_EXECUTIONS_LIMIT = 30;
const MAX_EXECUTIONS_LIMIT = 200;

type N8nWorkflowRow = {
  id?: string;
  name?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  tags?: Array<{ id?: string; name?: string }>;
};

type N8nWorkflowsResponse = {
  data?: N8nWorkflowRow[];
  nextCursor?: string | null;
};

type N8nWorkflowSingleResponse = N8nWorkflowRow & {
  nodes?: unknown[];
  connections?: Record<string, unknown>;
};

type N8nTriggerResponse = {
  executionId?: string | number;
  finished?: boolean;
  data?: unknown;
};

export type N8nWorkflowPreview = {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string | null;
  tags: string[];
};

export type N8nExecutionStatus = "queued" | "running" | "success" | "error";

export type N8nExecutionRecord = {
  id: string;
  workflowId: string;
  workflowName: string;
  status: N8nExecutionStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  source: "api" | "webhook";
  externalExecutionId: string | null;
  errorMessage: string | null;
};

export class N8nIntegrationError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
  ) {
    super(message);
    this.name = "N8nIntegrationError";
  }
}

const executionStore: N8nExecutionRecord[] = [];

function getN8nBaseUrl(): string {
  return (process.env.N8N_BASE_URL?.trim() ?? "").replace(/\/+$/, "");
}

function getN8nApiKey(): string {
  return process.env.N8N_API_KEY?.trim() ?? "";
}

function getN8nWebhookBaseUrl(): string {
  return (process.env.N8N_WEBHOOK_BASE_URL?.trim() ?? getN8nBaseUrl()).replace(/\/+$/, "");
}

function hasN8nCredentials(): boolean {
  return Boolean(getN8nBaseUrl() && getN8nApiKey());
}

function sanitizeLimit(value: number | undefined, fallback: number, max: number): number {
  const parsed = Number.isFinite(value) ? Number(value) : fallback;
  return Math.max(1, Math.min(parsed, max));
}

function normalizeDateTime(value?: string): string | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function trimText(value: string, max = 140): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

function buildAuthHeaders(includeJson = true): HeadersInit {
  const baseUrl = getN8nBaseUrl();
  const apiKey = getN8nApiKey();
  if (!baseUrl || !apiKey) {
    throw new N8nIntegrationError("N8N_BASE_URL e N8N_API_KEY sao obrigatorios para integracao n8n.", 503);
  }

  return {
    "X-N8N-API-KEY": apiKey,
    Accept: "application/json",
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
  };
}

async function readJsonError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; error?: { message?: string } };
    return payload.message?.trim() || payload.error?.message?.trim() || "";
  } catch {
    return "";
  }
}

async function n8nFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = getN8nBaseUrl();
  if (!baseUrl) {
    throw new N8nIntegrationError("N8N_BASE_URL nao configurado.", 503);
  }

  return fetch(`${baseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      ...buildAuthHeaders(init?.method !== "GET"),
      ...(init?.headers ?? {}),
    },
    body: init?.body,
    cache: "no-store",
  });
}

function mapWorkflow(item: N8nWorkflowRow): N8nWorkflowPreview {
  return {
    id: String(item.id ?? "").trim() || crypto.randomUUID(),
    name: trimText(item.name?.trim() || "(sem nome)", 120),
    active: Boolean(item.active),
    updatedAt: normalizeDateTime(item.updatedAt ?? item.createdAt),
    tags: (item.tags ?? [])
      .map((tag) => tag.name?.trim() || "")
      .filter(Boolean)
      .slice(0, 8),
  };
}

function addExecutionRecord(record: N8nExecutionRecord): void {
  executionStore.unshift(record);
  if (executionStore.length > MAX_EXECUTIONS_LIMIT) {
    executionStore.length = MAX_EXECUTIONS_LIMIT;
  }
}

function updateExecutionRecord(id: string, patch: Partial<N8nExecutionRecord>): N8nExecutionRecord | null {
  const target = executionStore.find((item) => item.id === id);
  if (!target) return null;

  Object.assign(target, patch);
  return target;
}

export function listN8nExecutionRecords(limit = DEFAULT_EXECUTIONS_LIMIT): N8nExecutionRecord[] {
  const safeLimit = sanitizeLimit(limit, DEFAULT_EXECUTIONS_LIMIT, MAX_EXECUTIONS_LIMIT);
  return executionStore.slice(0, safeLimit);
}

export async function listN8nWorkflows(limit = DEFAULT_WORKFLOWS_LIMIT): Promise<N8nWorkflowPreview[]> {
  const safeLimit = sanitizeLimit(limit, DEFAULT_WORKFLOWS_LIMIT, MAX_WORKFLOWS_LIMIT);
  const response = await n8nFetch(`/api/v1/workflows?limit=${safeLimit}`);
  if (!response.ok) {
    const apiError = await readJsonError(response);
    throw new N8nIntegrationError(apiError || `Falha ao listar workflows no n8n (${response.status}).`, response.status);
  }

  const payload = (await response.json()) as N8nWorkflowsResponse;
  return (payload.data ?? []).map(mapWorkflow);
}

async function fetchWorkflowById(workflowId: string): Promise<N8nWorkflowSingleResponse> {
  const response = await n8nFetch(`/api/v1/workflows/${encodeURIComponent(workflowId)}`);
  if (!response.ok) {
    const apiError = await readJsonError(response);
    throw new N8nIntegrationError(apiError || `Workflow n8n nao encontrado (${response.status}).`, response.status);
  }

  return (await response.json()) as N8nWorkflowSingleResponse;
}

async function triggerViaApi(workflowId: string, runData: unknown): Promise<{ externalExecutionId: string | null }> {
  const workflow = await fetchWorkflowById(workflowId);
  const response = await n8nFetch(`/api/v1/workflows/${encodeURIComponent(workflowId)}/run`, {
    method: "POST",
    body: JSON.stringify({
      workflowData: workflow,
      runData,
    }),
  });

  if (!response.ok) {
    const apiError = await readJsonError(response);
    throw new N8nIntegrationError(
      apiError || `Falha ao executar workflow n8n via API (${response.status}).`,
      response.status,
    );
  }

  const payload = (await response.json()) as N8nTriggerResponse;
  return {
    externalExecutionId:
      payload.executionId !== undefined && payload.executionId !== null ? String(payload.executionId) : null,
  };
}

async function triggerViaWebhook(webhookPath: string, payload: unknown): Promise<{ externalExecutionId: string | null }> {
  const base = getN8nWebhookBaseUrl();
  if (!base) {
    throw new N8nIntegrationError("N8N_WEBHOOK_BASE_URL/N8N_BASE_URL nao configurado para trigger webhook.", 503);
  }

  const sanitizedPath = webhookPath.trim().replace(/^\/+/, "");
  if (!sanitizedPath) {
    throw new N8nIntegrationError("webhookPath obrigatorio para trigger via webhook.", 400);
  }

  const response = await fetch(`${base}/webhook/${sanitizedPath}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  if (!response.ok) {
    const apiError = await readJsonError(response);
    throw new N8nIntegrationError(
      apiError || `Falha ao acionar webhook n8n (${response.status}).`,
      response.status,
    );
  }

  let externalExecutionId: string | null = null;
  try {
    const responsePayload = (await response.json()) as N8nTriggerResponse;
    if (responsePayload.executionId !== undefined && responsePayload.executionId !== null) {
      externalExecutionId = String(responsePayload.executionId);
    }
  } catch {
    externalExecutionId = null;
  }

  return { externalExecutionId };
}

export async function triggerN8nFlow(params: {
  workflowId: string;
  payload?: unknown;
  source?: "api" | "webhook";
  webhookPath?: string;
}): Promise<N8nExecutionRecord> {
  const workflowId = params.workflowId.trim();
  if (!workflowId) {
    throw new N8nIntegrationError("workflowId obrigatorio.", 400);
  }

  const source = params.source ?? "api";
  const startedAtIso = new Date().toISOString();
  const startedAtMs = Date.now();

  const executionRecord: N8nExecutionRecord = {
    id: crypto.randomUUID(),
    workflowId,
    workflowName: workflowId,
    status: "running",
    startedAt: startedAtIso,
    finishedAt: null,
    durationMs: null,
    source,
    externalExecutionId: null,
    errorMessage: null,
  };
  addExecutionRecord(executionRecord);

  logIntegrationEvent({
    integrationId: "n8n",
    level: "info",
    message: "Disparo de fluxo n8n iniciado.",
    metadata: {
      workflowId,
      source,
    },
  });

  try {
    const workflows = await listN8nWorkflows(100);
    const workflow = workflows.find((item) => item.id === workflowId);
    if (workflow) {
      executionRecord.workflowName = workflow.name;
    }

    const triggerResult =
      source === "webhook"
        ? await triggerViaWebhook(params.webhookPath ?? workflowId, params.payload ?? {})
        : await triggerViaApi(workflowId, params.payload ?? {});

    const finishedAt = new Date().toISOString();
    const updated = updateExecutionRecord(executionRecord.id, {
      status: "success",
      finishedAt,
      durationMs: Math.max(1, Date.now() - startedAtMs),
      externalExecutionId: triggerResult.externalExecutionId,
    });

    logIntegrationEvent({
      integrationId: "n8n",
      level: "info",
      message: "Disparo de fluxo n8n concluido.",
      metadata: {
        workflowId,
        source,
        durationMs: Math.max(1, Date.now() - startedAtMs),
      },
    });

    return updated ?? executionRecord;
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Erro inesperado no disparo do n8n.";
    const updated = updateExecutionRecord(executionRecord.id, {
      status: "error",
      finishedAt,
      durationMs: Math.max(1, Date.now() - startedAtMs),
      errorMessage: message,
    });

    logIntegrationEvent({
      integrationId: "n8n",
      level: "error",
      message: "Falha no disparo de fluxo n8n.",
      metadata: {
        workflowId,
        source,
      },
    });

    if (error instanceof N8nIntegrationError) throw error;
    throw new N8nIntegrationError(message, 500);
  }
}

export async function checkN8nConnection(): Promise<IntegrationCheckResult> {
  if (!hasN8nCredentials()) {
    return {
      status: "disabled",
      message: "Integracao n8n desabilitada por configuracao ausente.",
      details: ["Configure N8N_BASE_URL e N8N_API_KEY para habilitar automacoes operacionais."],
    };
  }

  const startedAt = Date.now();
  try {
    const workflows = await listN8nWorkflows(5);
    return {
      status: "ok",
      message: `Conexao n8n ativa com ${workflows.length} fluxo(s) retornado(s).`,
      details: workflows.slice(0, 3).map((item) => `Workflow: ${item.name} (${item.active ? "ativo" : "inativo"})`),
      latencyMs: Math.max(1, Date.now() - startedAt),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Falha inesperada na conexao n8n.",
      latencyMs: Math.max(1, Date.now() - startedAt),
    };
  }
}

