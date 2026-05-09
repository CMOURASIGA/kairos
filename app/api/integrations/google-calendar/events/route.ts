import { NextRequest, NextResponse } from "next/server";
import { GoogleCalendarIntegrationError, listGoogleCalendarEvents } from "@/services/integrations/google-calendar-service";
import { logIntegrationEvent } from "@/services/integrations/logger";
import { requireApiAuth } from "@/lib/api-auth";

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const limit = parsePositiveInt(searchParams.get("limit"), 10);
    const daysAhead = parsePositiveInt(searchParams.get("daysAhead"), 7);
    const calendarId = searchParams.get("calendarId") ?? undefined;
    const timeMin = searchParams.get("timeMin") ?? undefined;

    const events = await listGoogleCalendarEvents({
      limit,
      daysAhead,
      calendarId,
      timeMin,
    });

    return NextResponse.json({
      data: events,
      meta: {
        count: events.length,
        limit,
        daysAhead,
      },
    });
  } catch (error) {
    if (error instanceof GoogleCalendarIntegrationError) {
      logIntegrationEvent({
        integrationId: "google_calendar",
        level: "warn",
        message: "Falha controlada na leitura de eventos do Google Calendar.",
        metadata: {
          statusCode: error.statusCode,
        },
      });

      return NextResponse.json(
        {
          error: error.message,
        },
        { status: error.statusCode },
      );
    }

    console.error("[/api/integrations/google-calendar/events] GET error", error);
    logIntegrationEvent({
      integrationId: "google_calendar",
      level: "error",
      message: "Falha inesperada na leitura de eventos do Google Calendar.",
    });

    return NextResponse.json(
      {
        error: "Erro inesperado ao consultar eventos do Google Calendar.",
      },
      { status: 500 },
    );
  }
}
