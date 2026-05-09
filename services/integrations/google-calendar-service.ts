import { logIntegrationEvent } from "@/services/integrations/logger";
import { IntegrationCheckResult } from "@/services/integrations/types";

const GOOGLE_CALENDAR_API_BASE_URL = "https://www.googleapis.com/calendar/v3";
const DEFAULT_CALENDAR_ID = "primary";
const DEFAULT_EVENTS_LIMIT = 10;
const MAX_EVENTS_LIMIT = 20;
const DEFAULT_LOOKAHEAD_DAYS = 7;
const MAX_LOOKAHEAD_DAYS = 30;

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  description?: string;
  status?: string;
  htmlLink?: string;
  location?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
};

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
};

type GoogleCalendarMetadataResponse = {
  id?: string;
  summary?: string;
  timeZone?: string;
  accessRole?: string;
};

export type GoogleCalendarEventPreview = {
  id: string;
  title: string;
  status: string;
  isAllDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  dateLabel: string;
  location: string;
  descriptionPreview: string;
  htmlLink: string;
};

export class GoogleCalendarIntegrationError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
  ) {
    super(message);
    this.name = "GoogleCalendarIntegrationError";
  }
}

function getGoogleCalendarAccessToken(): string {
  return process.env.GOOGLE_CALENDAR_ACCESS_TOKEN?.trim() ?? "";
}

function getGoogleCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID?.trim() || DEFAULT_CALENDAR_ID;
}

function hasGoogleCalendarCredentials(): boolean {
  return Boolean(getGoogleCalendarAccessToken());
}

function sanitizeEventsLimit(limit?: number): number {
  const value = Number.isFinite(limit) ? Number(limit) : DEFAULT_EVENTS_LIMIT;
  return Math.max(1, Math.min(value, MAX_EVENTS_LIMIT));
}

function sanitizeLookaheadDays(days?: number): number {
  const value = Number.isFinite(days) ? Number(days) : DEFAULT_LOOKAHEAD_DAYS;
  return Math.max(1, Math.min(value, MAX_LOOKAHEAD_DAYS));
}

function trimPreview(text: string, max = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

function buildAuthHeaders(): HeadersInit {
  const token = getGoogleCalendarAccessToken();
  if (!token) {
    throw new GoogleCalendarIntegrationError("GOOGLE_CALENDAR_ACCESS_TOKEN nao configurado.", 503);
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

async function googleCalendarFetch(path: string): Promise<Response> {
  return fetch(`${GOOGLE_CALENDAR_API_BASE_URL}${path}`, {
    method: "GET",
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
}

function normalizeDateTime(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function mapGoogleCalendarEvent(item: GoogleCalendarEvent): GoogleCalendarEventPreview {
  const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
  const startsAt = normalizeDateTime(item.start?.dateTime ?? item.start?.date);
  const endsAt = normalizeDateTime(item.end?.dateTime ?? item.end?.date);
  const dateLabel = startsAt
    ? new Date(startsAt).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: isAllDay ? undefined : "short",
    })
    : "Sem data";

  return {
    id: item.id?.trim() || crypto.randomUUID(),
    title: trimPreview(item.summary?.trim() || "(sem titulo)", 120),
    status: item.status?.trim() || "confirmed",
    isAllDay,
    startsAt,
    endsAt,
    dateLabel,
    location: trimPreview(item.location?.trim() || "", 120),
    descriptionPreview: trimPreview(item.description?.trim() || "", 220),
    htmlLink: item.htmlLink?.trim() || "",
  };
}

export async function checkGoogleCalendarConnection(): Promise<IntegrationCheckResult> {
  if (!hasGoogleCalendarCredentials()) {
    return {
      status: "disabled",
      message: "Integracao Google Calendar desabilitada por ausencia de token OAuth.",
      details: ["Configure GOOGLE_CALENDAR_ACCESS_TOKEN para habilitar leitura de agenda."],
    };
  }

  const startedAt = Date.now();
  const calendarId = getGoogleCalendarId();

  try {
    const response = await googleCalendarFetch(`/calendars/${encodeURIComponent(calendarId)}`);
    const latencyMs = Math.max(1, Date.now() - startedAt);

    if (!response.ok) {
      const calendarError = await readJsonError(response);
      return {
        status: "error",
        message: calendarError || `Falha de autenticacao/conexao Google Calendar (${response.status}).`,
        latencyMs,
      };
    }

    const metadata = (await response.json()) as GoogleCalendarMetadataResponse;
    return {
      status: "ok",
      message: `Conexao Google Calendar ativa para ${metadata.summary || calendarId}.`,
      details: [
        `Timezone: ${metadata.timeZone || "nao informado"}`,
        `Permissao: ${metadata.accessRole || "nao informado"}`,
      ],
      latencyMs,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Falha inesperada na conexao Google Calendar.",
      latencyMs: Math.max(1, Date.now() - startedAt),
    };
  }
}

export async function listGoogleCalendarEvents(params?: {
  limit?: number;
  daysAhead?: number;
  calendarId?: string;
  timeMin?: string;
}): Promise<GoogleCalendarEventPreview[]> {
  const limit = sanitizeEventsLimit(params?.limit);
  const daysAhead = sanitizeLookaheadDays(params?.daysAhead);
  const calendarId = params?.calendarId?.trim() || getGoogleCalendarId();
  const now = new Date();
  const timeMin = params?.timeMin ? new Date(params.timeMin) : now;
  const safeTimeMin = Number.isNaN(timeMin.getTime()) ? now : timeMin;
  const timeMax = new Date(safeTimeMin.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  logIntegrationEvent({
    integrationId: "google_calendar",
    level: "info",
    message: "Iniciando leitura segura de eventos do Google Calendar.",
    metadata: {
      limit,
      daysAhead,
      calendarId,
    },
  });

  const qs = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: `${limit}`,
    timeMin: safeTimeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    fields: "items(id,summary,description,status,htmlLink,location,start,end)",
  });

  const startedAt = Date.now();
  const response = await googleCalendarFetch(`/calendars/${encodeURIComponent(calendarId)}/events?${qs.toString()}`);
  if (!response.ok) {
    const calendarError = await readJsonError(response);
    throw new GoogleCalendarIntegrationError(
      calendarError || `Falha ao listar eventos do Google Calendar (${response.status}).`,
      response.status,
    );
  }

  const payload = (await response.json()) as GoogleCalendarEventsResponse;
  const events = (payload.items ?? []).map(mapGoogleCalendarEvent);

  logIntegrationEvent({
    integrationId: "google_calendar",
    level: "info",
    message: "Leitura Google Calendar concluida com sucesso.",
    metadata: {
      count: events.length,
      latencyMs: Math.max(1, Date.now() - startedAt),
      daysAhead,
    },
  });

  return events;
}

