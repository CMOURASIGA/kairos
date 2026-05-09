import { NextRequest, NextResponse } from "next/server";
import { GmailIntegrationError, listGmailMessages } from "@/services/integrations/gmail-service";
import { logIntegrationEvent } from "@/services/integrations/logger";
import { requireApiAuth } from "@/lib/api-auth";

function parseLimit(raw: string | null): number {
  if (!raw) return 10;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return 10;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));
    const query = searchParams.get("q") ?? "";

    const messages = await listGmailMessages({ limit, query });
    return NextResponse.json({
      data: messages,
      meta: {
        count: messages.length,
        limit,
      },
    });
  } catch (error) {
    if (error instanceof GmailIntegrationError) {
      logIntegrationEvent({
        integrationId: "gmail",
        level: "warn",
        message: "Falha controlada na leitura de emails Gmail.",
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

    console.error("[/api/integrations/gmail/messages] GET error", error);
    logIntegrationEvent({
      integrationId: "gmail",
      level: "error",
      message: "Falha inesperada na leitura de emails Gmail.",
    });

    return NextResponse.json(
      {
        error: "Erro inesperado ao consultar emails do Gmail.",
      },
      { status: 500 },
    );
  }
}
