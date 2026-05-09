import { NextRequest, NextResponse } from "next/server";
import { GoogleDriveIntegrationError, listGoogleDriveFiles } from "@/services/integrations/google-drive-service";
import { logIntegrationEvent } from "@/services/integrations/logger";
import { requireApiAuth } from "@/lib/api-auth";

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseBoolean(raw: string | null): boolean {
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const limit = parsePositiveInt(searchParams.get("limit"), 10);
    const query = searchParams.get("q") ?? "";
    const includeShared = parseBoolean(searchParams.get("includeShared"));
    const pageToken = searchParams.get("pageToken") ?? "";

    const result = await listGoogleDriveFiles({
      limit,
      query,
      includeShared,
      pageToken,
    });

    return NextResponse.json({
      data: result.files,
      meta: {
        count: result.files.length,
        limit,
        includeShared,
        nextPageToken: result.nextPageToken,
      },
    });
  } catch (error) {
    if (error instanceof GoogleDriveIntegrationError) {
      logIntegrationEvent({
        integrationId: "google_drive",
        level: "warn",
        message: "Falha controlada na leitura de arquivos do Google Drive.",
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

    console.error("[/api/integrations/google-drive/files] GET error", error);
    logIntegrationEvent({
      integrationId: "google_drive",
      level: "error",
      message: "Falha inesperada na leitura de arquivos do Google Drive.",
    });

    return NextResponse.json(
      {
        error: "Erro inesperado ao consultar arquivos do Google Drive.",
      },
      { status: 500 },
    );
  }
}
