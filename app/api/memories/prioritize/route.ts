import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { runMemoryPriorityMaintenance } from "@/services/memory-service";

type PrioritizePayload = {
  limit?: number;
};

export async function POST(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as PrioritizePayload;
    const result = await runMemoryPriorityMaintenance(auth.context.userId, {
      limit: body.limit,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[/api/memories/prioritize] POST error", error);
    return NextResponse.json({ error: "Erro ao priorizar memorias." }, { status: 500 });
  }
}
