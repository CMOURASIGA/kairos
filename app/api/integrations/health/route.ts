import { NextRequest, NextResponse } from "next/server";
import { getIntegrationHealthReport } from "@/services/integrations";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const report = await getIntegrationHealthReport();
    return NextResponse.json(report);
  } catch (error) {
    console.error("[/api/integrations/health] GET error", error);
    return NextResponse.json(
      {
        error: "Falha ao montar healthcheck de integracoes.",
      },
      { status: 500 },
    );
  }
}
