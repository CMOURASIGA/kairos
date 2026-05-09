import { logIntegrationEvent } from "@/services/integrations/logger";
import { IntegrationCheckResult } from "@/services/integrations/types";

const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1";
const DEFAULT_GMAIL_USER_ID = "me";
const DEFAULT_MESSAGE_LIMIT = 10;
const MAX_MESSAGE_LIMIT = 20;

type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailMessageListRow = {
  id: string;
  threadId: string;
};

type GmailMessageMetadataResponse = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: GmailHeader[];
  };
};

type GmailMessagesListResponse = {
  messages?: GmailMessageListRow[];
  resultSizeEstimate?: number;
};

type GmailProfileResponse = {
  emailAddress?: string;
  messagesTotal?: number;
};

export type GmailMessagePreview = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  labelIds: string[];
  receivedAt: string | null;
};

export class GmailIntegrationError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
  ) {
    super(message);
    this.name = "GmailIntegrationError";
  }
}

function getGmailAccessToken(): string {
  return process.env.GMAIL_ACCESS_TOKEN?.trim() ?? "";
}

function getGmailUserId(): string {
  return process.env.GMAIL_USER_ID?.trim() || DEFAULT_GMAIL_USER_ID;
}

function hasGmailCredentials(): boolean {
  return Boolean(getGmailAccessToken());
}

function sanitizeMessageLimit(limit?: number): number {
  const value = Number.isFinite(limit) ? Number(limit) : DEFAULT_MESSAGE_LIMIT;
  return Math.max(1, Math.min(value, MAX_MESSAGE_LIMIT));
}

function sanitizeQuery(query?: string): string {
  if (!query) return "";
  return query.replace(/\s+/g, " ").trim().slice(0, 160);
}

function buildAuthHeaders(): HeadersInit {
  const token = getGmailAccessToken();
  if (!token) {
    throw new GmailIntegrationError("GMAIL_ACCESS_TOKEN nao configurado.", 503);
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

async function gmailFetch(path: string): Promise<Response> {
  const response = await fetch(`${GMAIL_API_BASE_URL}${path}`, {
    method: "GET",
    headers: buildAuthHeaders(),
    cache: "no-store",
  });

  return response;
}

function getHeaderValue(headers: GmailHeader[] | undefined, key: string): string {
  const target = headers?.find((item) => item.name?.toLowerCase() === key.toLowerCase());
  return target?.value?.trim() ?? "";
}

function trimPreview(text: string, max = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

async function readJsonError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message?.trim() || "";
  } catch {
    return "";
  }
}

async function fetchMessageMetadata(userId: string, messageId: string): Promise<GmailMessageMetadataResponse> {
  const path = `/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&fields=id,threadId,labelIds,snippet,internalDate,payload/headers`;
  const response = await gmailFetch(path);
  if (!response.ok) {
    const gmailError = await readJsonError(response);
    throw new GmailIntegrationError(
      gmailError || `Falha ao ler metadados da mensagem (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as GmailMessageMetadataResponse;
}

export async function checkGmailConnection(): Promise<IntegrationCheckResult> {
  if (!hasGmailCredentials()) {
    return {
      status: "disabled",
      message: "Integracao Gmail desabilitada por ausencia de token OAuth.",
      details: ["Configure GMAIL_ACCESS_TOKEN para habilitar leitura de emails."],
    };
  }

  const startedAt = Date.now();
  try {
    const userId = getGmailUserId();
    const response = await gmailFetch(`/users/${encodeURIComponent(userId)}/profile`);
    const latencyMs = Math.max(1, Date.now() - startedAt);

    if (!response.ok) {
      const gmailError = await readJsonError(response);
      return {
        status: "error",
        message: gmailError || `Falha de autenticacao/conexao Gmail (${response.status}).`,
        latencyMs,
      };
    }

    const profile = (await response.json()) as GmailProfileResponse;
    const address = profile.emailAddress || userId;
    return {
      status: "ok",
      message: `Conexao Gmail ativa para ${address}.`,
      details: [
        `Mensagens totais estimadas: ${profile.messagesTotal ?? 0}`,
      ],
      latencyMs,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Falha inesperada na conexao Gmail.",
      latencyMs: Math.max(1, Date.now() - startedAt),
    };
  }
}

export async function listGmailMessages(params?: {
  limit?: number;
  query?: string;
}): Promise<GmailMessagePreview[]> {
  const userId = getGmailUserId();
  const limit = sanitizeMessageLimit(params?.limit);
  const query = sanitizeQuery(params?.query);

  logIntegrationEvent({
    integrationId: "gmail",
    level: "info",
    message: "Iniciando leitura segura de emails do Gmail.",
    metadata: {
      limit,
      hasQuery: Boolean(query),
    },
  });

  const qs = new URLSearchParams({
    maxResults: `${limit}`,
    includeSpamTrash: "false",
    fields: "messages/id,messages/threadId,resultSizeEstimate",
  });
  if (query) qs.set("q", query);

  const startedAt = Date.now();
  const listResponse = await gmailFetch(`/users/${encodeURIComponent(userId)}/messages?${qs.toString()}`);
  if (!listResponse.ok) {
    const gmailError = await readJsonError(listResponse);
    throw new GmailIntegrationError(
      gmailError || `Falha ao listar emails do Gmail (${listResponse.status}).`,
      listResponse.status,
    );
  }

  const listPayload = (await listResponse.json()) as GmailMessagesListResponse;
  const messages = listPayload.messages ?? [];
  if (messages.length === 0) {
    logIntegrationEvent({
      integrationId: "gmail",
      level: "info",
      message: "Leitura Gmail concluida sem mensagens no filtro atual.",
      metadata: {
        limit,
        hasQuery: Boolean(query),
      },
    });
    return [];
  }

  const metadataList = await Promise.all(messages.map((item) => fetchMessageMetadata(userId, item.id)));
  const previews: GmailMessagePreview[] = metadataList.map((item) => {
    const headers = item.payload?.headers ?? [];
    const internalDateMs = Number(item.internalDate ?? 0);
    const receivedAt = Number.isFinite(internalDateMs) && internalDateMs > 0
      ? new Date(internalDateMs).toISOString()
      : null;

    return {
      id: item.id,
      threadId: item.threadId,
      subject: trimPreview(getHeaderValue(headers, "Subject") || "(sem assunto)", 140),
      from: trimPreview(getHeaderValue(headers, "From") || "(remetente nao informado)", 140),
      date: trimPreview(getHeaderValue(headers, "Date") || "", 140),
      snippet: trimPreview(item.snippet ?? "", 220),
      labelIds: item.labelIds ?? [],
      receivedAt,
    };
  });

  logIntegrationEvent({
    integrationId: "gmail",
    level: "info",
    message: "Leitura Gmail concluida com sucesso.",
    metadata: {
      count: previews.length,
      latencyMs: Math.max(1, Date.now() - startedAt),
      hasQuery: Boolean(query),
    },
  });

  return previews;
}

