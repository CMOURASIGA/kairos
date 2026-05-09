import { logIntegrationEvent } from "@/services/integrations/logger";
import { IntegrationCheckResult } from "@/services/integrations/types";

const GOOGLE_DRIVE_API_BASE_URL = "https://www.googleapis.com/drive/v3";
const DEFAULT_FILES_LIMIT = 10;
const MAX_FILES_LIMIT = 30;

type GoogleDriveFileRow = {
  id?: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  createdTime?: string;
  size?: string;
  trashed?: boolean;
  webViewLink?: string;
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
  }>;
  permissions?: Array<{
    type?: string;
    role?: string;
    emailAddress?: string;
    domain?: string;
  }>;
};

type GoogleDriveFilesResponse = {
  files?: GoogleDriveFileRow[];
  nextPageToken?: string;
};

type GoogleDriveAboutResponse = {
  user?: {
    displayName?: string;
    emailAddress?: string;
  };
  storageQuota?: {
    limit?: string;
    usage?: string;
  };
};

export type GoogleDriveFilePreview = {
  id: string;
  name: string;
  mimeType: string;
  modifiedAt: string | null;
  createdAt: string | null;
  sizeBytes: number | null;
  ownerLabel: string;
  webViewLink: string;
  permissionRoles: string[];
  accessLevel: "read_only" | "read_comment" | "read_write" | "unknown";
};

export class GoogleDriveIntegrationError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
  ) {
    super(message);
    this.name = "GoogleDriveIntegrationError";
  }
}

function getGoogleDriveAccessToken(): string {
  return process.env.GOOGLE_DRIVE_ACCESS_TOKEN?.trim() ?? "";
}

function hasGoogleDriveCredentials(): boolean {
  return Boolean(getGoogleDriveAccessToken());
}

function sanitizeFilesLimit(limit?: number): number {
  const value = Number.isFinite(limit) ? Number(limit) : DEFAULT_FILES_LIMIT;
  return Math.max(1, Math.min(value, MAX_FILES_LIMIT));
}

function trimPreview(text: string, max = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

function normalizeDateTime(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseSize(value?: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function deriveAccessLevel(roles: string[]): GoogleDriveFilePreview["accessLevel"] {
  const normalized = roles.map((item) => item.toLowerCase());
  if (normalized.includes("owner") || normalized.includes("writer")) return "read_write";
  if (normalized.includes("commenter")) return "read_comment";
  if (normalized.includes("reader")) return "read_only";
  return "unknown";
}

function buildAuthHeaders(): HeadersInit {
  const token = getGoogleDriveAccessToken();
  if (!token) {
    throw new GoogleDriveIntegrationError("GOOGLE_DRIVE_ACCESS_TOKEN nao configurado.", 503);
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

async function readJsonError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message?.trim() || "";
  } catch {
    return "";
  }
}

async function googleDriveFetch(path: string): Promise<Response> {
  return fetch(`${GOOGLE_DRIVE_API_BASE_URL}${path}`, {
    method: "GET",
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
}

function mapGoogleDriveFile(item: GoogleDriveFileRow): GoogleDriveFilePreview {
  const permissions = item.permissions ?? [];
  const permissionRoles = permissions
    .map((entry) => entry.role?.trim() || "")
    .filter(Boolean);

  const owner = item.owners?.[0];
  const ownerLabel = trimPreview(
    owner?.displayName?.trim() || owner?.emailAddress?.trim() || "(sem proprietario)",
    120,
  );

  return {
    id: item.id?.trim() || crypto.randomUUID(),
    name: trimPreview(item.name?.trim() || "(sem nome)", 120),
    mimeType: item.mimeType?.trim() || "application/octet-stream",
    modifiedAt: normalizeDateTime(item.modifiedTime),
    createdAt: normalizeDateTime(item.createdTime),
    sizeBytes: parseSize(item.size),
    ownerLabel,
    webViewLink: item.webViewLink?.trim() || "",
    permissionRoles,
    accessLevel: deriveAccessLevel(permissionRoles),
  };
}

export async function checkGoogleDriveConnection(): Promise<IntegrationCheckResult> {
  if (!hasGoogleDriveCredentials()) {
    return {
      status: "disabled",
      message: "Integracao Google Drive desabilitada por ausencia de token OAuth.",
      details: ["Configure GOOGLE_DRIVE_ACCESS_TOKEN para habilitar leitura de arquivos."],
    };
  }

  const startedAt = Date.now();
  try {
    const response = await googleDriveFetch(
      "/about?fields=user(displayName,emailAddress),storageQuota(limit,usage)",
    );
    const latencyMs = Math.max(1, Date.now() - startedAt);

    if (!response.ok) {
      const driveError = await readJsonError(response);
      return {
        status: "error",
        message: driveError || `Falha de autenticacao/conexao Google Drive (${response.status}).`,
        latencyMs,
      };
    }

    const about = (await response.json()) as GoogleDriveAboutResponse;
    const user = about.user?.displayName || about.user?.emailAddress || "usuario";
    return {
      status: "ok",
      message: `Conexao Google Drive ativa para ${user}.`,
      details: [
        `Uso estimado (bytes): ${about.storageQuota?.usage ?? "nao informado"}`,
      ],
      latencyMs,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Falha inesperada na conexao Google Drive.",
      latencyMs: Math.max(1, Date.now() - startedAt),
    };
  }
}

export async function listGoogleDriveFiles(params?: {
  limit?: number;
  query?: string;
  includeShared?: boolean;
  pageToken?: string;
}): Promise<{ files: GoogleDriveFilePreview[]; nextPageToken: string | null }> {
  const limit = sanitizeFilesLimit(params?.limit);
  const query = (params?.query ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
  const includeShared = Boolean(params?.includeShared);
  const pageToken = (params?.pageToken ?? "").trim();

  logIntegrationEvent({
    integrationId: "google_drive",
    level: "info",
    message: "Iniciando leitura segura de arquivos do Google Drive.",
    metadata: {
      limit,
      includeShared,
      hasQuery: Boolean(query),
      hasPageToken: Boolean(pageToken),
    },
  });

  const filters: string[] = ["trashed = false"];
  if (query) {
    const escapedQuery = query.replace(/'/g, "\\'");
    filters.push(`(name contains '${escapedQuery}' or fullText contains '${escapedQuery}')`);
  }

  const qs = new URLSearchParams({
    pageSize: `${limit}`,
    orderBy: "modifiedTime desc",
    q: filters.join(" and "),
    fields:
      "nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,size,trashed,webViewLink,owners(displayName,emailAddress),permissions(type,role,emailAddress,domain))",
    supportsAllDrives: includeShared ? "true" : "false",
    includeItemsFromAllDrives: includeShared ? "true" : "false",
    corpora: includeShared ? "allDrives" : "user",
  });
  if (pageToken) qs.set("pageToken", pageToken);

  const startedAt = Date.now();
  const response = await googleDriveFetch(`/files?${qs.toString()}`);
  if (!response.ok) {
    const driveError = await readJsonError(response);
    throw new GoogleDriveIntegrationError(
      driveError || `Falha ao listar arquivos do Google Drive (${response.status}).`,
      response.status,
    );
  }

  const payload = (await response.json()) as GoogleDriveFilesResponse;
  const rawFiles = payload.files ?? [];
  const mappedFiles = rawFiles
    .filter((item) => !item.trashed)
    .map(mapGoogleDriveFile)
    .filter((item) => item.accessLevel !== "unknown");

  logIntegrationEvent({
    integrationId: "google_drive",
    level: "info",
    message: "Leitura Google Drive concluida com sucesso.",
    metadata: {
      count: mappedFiles.length,
      latencyMs: Math.max(1, Date.now() - startedAt),
      includeShared,
    },
  });

  return {
    files: mappedFiles,
    nextPageToken: payload.nextPageToken?.trim() || null,
  };
}

