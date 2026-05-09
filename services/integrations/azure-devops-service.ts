import { logIntegrationEvent } from "@/services/integrations/logger";
import { IntegrationCheckResult } from "@/services/integrations/types";

const DEFAULT_WORK_ITEMS_LIMIT = 10;
const MAX_WORK_ITEMS_LIMIT = 40;
const PROJECTS_FETCH_LIMIT = 100;

type AzureDevOpsProjectRow = {
  id?: string;
  name?: string;
  description?: string;
  state?: string;
  visibility?: string;
  lastUpdateTime?: string;
  url?: string;
};

type AzureDevOpsProjectsResponse = {
  value?: AzureDevOpsProjectRow[];
};

type AzureDevOpsWiqlRow = {
  id?: number;
  url?: string;
};

type AzureDevOpsWiqlResponse = {
  workItems?: AzureDevOpsWiqlRow[];
};

type AzureDevOpsWorkItemRow = {
  id?: number;
  fields?: Record<string, unknown>;
  url?: string;
};

type AzureDevOpsWorkItemsResponse = {
  value?: AzureDevOpsWorkItemRow[];
};

export type AzureDevOpsProjectPreview = {
  id: string;
  name: string;
  description: string;
  state: string;
  visibility: string;
  updatedAt: string | null;
  url: string;
};

export type AzureDevOpsWorkItemPreview = {
  id: number;
  title: string;
  type: string;
  state: string;
  project: string;
  assignedTo: string;
  changedAt: string | null;
  tags: string[];
  url: string;
  deepLink: string;
};

export class AzureDevOpsIntegrationError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
  ) {
    super(message);
    this.name = "AzureDevOpsIntegrationError";
  }
}

function getAzureDevOpsOrgUrl(): string {
  return (process.env.AZURE_DEVOPS_ORG_URL?.trim() ?? "").replace(/\/+$/, "");
}

function getAzureDevOpsPat(): string {
  return process.env.AZURE_DEVOPS_PAT?.trim() ?? "";
}

function getAzureDevOpsDefaultProject(): string {
  return process.env.AZURE_DEVOPS_PROJECT?.trim() ?? "";
}

function hasAzureDevOpsCredentials(): boolean {
  return Boolean(getAzureDevOpsOrgUrl() && getAzureDevOpsPat());
}

function sanitizeWorkItemsLimit(limit?: number): number {
  const value = Number.isFinite(limit) ? Number(limit) : DEFAULT_WORK_ITEMS_LIMIT;
  return Math.max(1, Math.min(value, MAX_WORK_ITEMS_LIMIT));
}

function trimPreview(text: string, max = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

function normalizeDateTime(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseAssignedTo(value: unknown): string {
  if (!value) return "Nao atribuido";
  if (typeof value === "string") return trimPreview(value, 120);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const displayName = typeof record.displayName === "string" ? record.displayName : "";
    const uniqueName = typeof record.uniqueName === "string" ? record.uniqueName : "";
    return trimPreview(displayName || uniqueName || "Nao atribuido", 120);
  }
  return "Nao atribuido";
}

function parseTags(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function buildAuthHeaders(): HeadersInit {
  const orgUrl = getAzureDevOpsOrgUrl();
  const pat = getAzureDevOpsPat();
  if (!orgUrl || !pat) {
    throw new AzureDevOpsIntegrationError(
      "AZURE_DEVOPS_ORG_URL e AZURE_DEVOPS_PAT sao obrigatorios para integracao Azure DevOps.",
      503,
    );
  }

  const encoded = Buffer.from(`:${pat}`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    Accept: "application/json",
    "Content-Type": "application/json",
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

async function azureDevOpsFetch(path: string, init?: RequestInit): Promise<Response> {
  const orgUrl = getAzureDevOpsOrgUrl();
  if (!orgUrl) {
    throw new AzureDevOpsIntegrationError("AZURE_DEVOPS_ORG_URL nao configurado.", 503);
  }

  return fetch(`${orgUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      ...buildAuthHeaders(),
      ...(init?.headers ?? {}),
    },
    body: init?.body,
    cache: "no-store",
  });
}

function mapProject(item: AzureDevOpsProjectRow): AzureDevOpsProjectPreview {
  return {
    id: item.id?.trim() || crypto.randomUUID(),
    name: trimPreview(item.name?.trim() || "(sem nome)", 120),
    description: trimPreview(item.description?.trim() || "", 200),
    state: item.state?.trim() || "unknown",
    visibility: item.visibility?.trim() || "unknown",
    updatedAt: normalizeDateTime(item.lastUpdateTime),
    url: item.url?.trim() || "",
  };
}

function mapWorkItem(item: AzureDevOpsWorkItemRow): AzureDevOpsWorkItemPreview | null {
  if (!item.id) return null;

  const fields = item.fields ?? {};
  const project = typeof fields["System.TeamProject"] === "string" ? fields["System.TeamProject"] : "";
  const title = typeof fields["System.Title"] === "string" ? fields["System.Title"] : "";
  const type = typeof fields["System.WorkItemType"] === "string" ? fields["System.WorkItemType"] : "";
  const state = typeof fields["System.State"] === "string" ? fields["System.State"] : "";

  return {
    id: item.id,
    title: trimPreview(title || "(sem titulo)", 160),
    type: trimPreview(type || "WorkItem", 60),
    state: trimPreview(state || "Unknown", 60),
    project: trimPreview(project || "Sem projeto", 120),
    assignedTo: parseAssignedTo(fields["System.AssignedTo"]),
    changedAt: normalizeDateTime(fields["System.ChangedDate"]),
    tags: parseTags(fields["System.Tags"]),
    url: item.url?.trim() || "",
    deepLink: project
      ? `${getAzureDevOpsOrgUrl()}/${encodeURIComponent(project)}/_workitems/edit/${item.id}`
      : `${getAzureDevOpsOrgUrl()}/_workitems/edit/${item.id}`,
  };
}

export async function listAzureDevOpsProjects(): Promise<AzureDevOpsProjectPreview[]> {
  const response = await azureDevOpsFetch(
    `/_apis/projects?api-version=7.1&stateFilter=wellFormed&$top=${PROJECTS_FETCH_LIMIT}`,
  );
  if (!response.ok) {
    const apiError = await readJsonError(response);
    throw new AzureDevOpsIntegrationError(
      apiError || `Falha ao listar projetos do Azure DevOps (${response.status}).`,
      response.status,
    );
  }

  const payload = (await response.json()) as AzureDevOpsProjectsResponse;
  return (payload.value ?? []).map(mapProject).sort((a, b) => a.name.localeCompare(b.name));
}

function buildWiqlQuery(params: { project?: string; top: number; onlyOpen: boolean }): string {
  const clauses: string[] = [];
  if (params.project) {
    const escapedProject = params.project.replace(/'/g, "''");
    clauses.push(`[System.TeamProject] = '${escapedProject}'`);
  }

  if (params.onlyOpen) {
    clauses.push("[System.State] <> 'Closed'");
    clauses.push("[System.State] <> 'Done'");
    clauses.push("[System.State] <> 'Removed'");
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return [
    `SELECT TOP ${params.top}`,
    "[System.Id]",
    "FROM WorkItems",
    where,
    "ORDER BY [System.ChangedDate] DESC",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function queryWorkItemIds(params: {
  project?: string;
  top: number;
  onlyOpen: boolean;
}): Promise<number[]> {
  const wiql = buildWiqlQuery(params);
  const path = params.project
    ? `/${encodeURIComponent(params.project)}/_apis/wit/wiql?api-version=7.1`
    : "/_apis/wit/wiql?api-version=7.1";

  const response = await azureDevOpsFetch(path, {
    method: "POST",
    body: JSON.stringify({ query: wiql }),
  });
  if (!response.ok) {
    const apiError = await readJsonError(response);
    throw new AzureDevOpsIntegrationError(
      apiError || `Falha ao consultar WIQL no Azure DevOps (${response.status}).`,
      response.status,
    );
  }

  const payload = (await response.json()) as AzureDevOpsWiqlResponse;
  return (payload.workItems ?? [])
    .map((item) => item.id ?? 0)
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function fetchWorkItemsByIds(ids: number[]): Promise<AzureDevOpsWorkItemPreview[]> {
  if (!ids.length) return [];

  const fields = [
    "System.Id",
    "System.Title",
    "System.State",
    "System.WorkItemType",
    "System.TeamProject",
    "System.AssignedTo",
    "System.ChangedDate",
    "System.Tags",
  ].join(",");

  const response = await azureDevOpsFetch(
    `/_apis/wit/workitems?api-version=7.1&ids=${ids.join(",")}&fields=${encodeURIComponent(fields)}`,
  );
  if (!response.ok) {
    const apiError = await readJsonError(response);
    throw new AzureDevOpsIntegrationError(
      apiError || `Falha ao buscar detalhes dos work items (${response.status}).`,
      response.status,
    );
  }

  const payload = (await response.json()) as AzureDevOpsWorkItemsResponse;
  return (payload.value ?? [])
    .map(mapWorkItem)
    .filter((item): item is AzureDevOpsWorkItemPreview => item !== null)
    .sort((a, b) => {
      const aTime = a.changedAt ? new Date(a.changedAt).getTime() : 0;
      const bTime = b.changedAt ? new Date(b.changedAt).getTime() : 0;
      return bTime - aTime;
    });
}

export async function listAzureDevOpsWorkItems(params?: {
  project?: string;
  limit?: number;
  onlyOpen?: boolean;
}): Promise<AzureDevOpsWorkItemPreview[]> {
  const limit = sanitizeWorkItemsLimit(params?.limit);
  const project = params?.project?.trim() || getAzureDevOpsDefaultProject() || undefined;
  const onlyOpen = params?.onlyOpen ?? true;

  logIntegrationEvent({
    integrationId: "azure_devops",
    level: "info",
    message: "Iniciando leitura de work items do Azure DevOps.",
    metadata: {
      limit,
      onlyOpen,
      hasProject: Boolean(project),
    },
  });

  const startedAt = Date.now();
  const ids = await queryWorkItemIds({ project, top: limit, onlyOpen });
  if (!ids.length) {
    logIntegrationEvent({
      integrationId: "azure_devops",
      level: "info",
      message: "Nenhum work item encontrado para o filtro atual.",
      metadata: {
        limit,
        onlyOpen,
      },
    });
    return [];
  }

  const workItems = await fetchWorkItemsByIds(ids);
  logIntegrationEvent({
    integrationId: "azure_devops",
    level: "info",
    message: "Leitura de work items do Azure DevOps concluida.",
    metadata: {
      count: workItems.length,
      latencyMs: Math.max(1, Date.now() - startedAt),
      onlyOpen,
    },
  });

  return workItems.slice(0, limit);
}

export async function checkAzureDevOpsConnection(): Promise<IntegrationCheckResult> {
  if (!hasAzureDevOpsCredentials()) {
    return {
      status: "disabled",
      message: "Integracao Azure DevOps desabilitada por configuracao ausente.",
      details: ["Configure AZURE_DEVOPS_ORG_URL e AZURE_DEVOPS_PAT para habilitar a leitura."],
    };
  }

  const startedAt = Date.now();
  try {
    const projects = await listAzureDevOpsProjects();
    const latencyMs = Math.max(1, Date.now() - startedAt);
    return {
      status: "ok",
      message: `Conexao Azure DevOps ativa com ${projects.length} projeto(s) acessivel(is).`,
      details: projects.slice(0, 3).map((project) => `Projeto: ${project.name}`),
      latencyMs,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Falha inesperada na conexao Azure DevOps.",
      latencyMs: Math.max(1, Date.now() - startedAt),
    };
  }
}

