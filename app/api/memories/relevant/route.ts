import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { searchRelevantMemories } from "@/services/memory-service";

function parseLimit(raw: string | null): number {
  if (!raw) return 5;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) return 5;
  return Math.max(1, Math.min(value, 20));
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    if (!query) {
      return NextResponse.json({ error: "Parametro 'q' obrigatorio." }, { status: 400 });
    }

    const limit = parseLimit(searchParams.get("limit"));
    const memories = await searchRelevantMemories(auth.context.userId, query, limit);

    return NextResponse.json({
      data: memories,
      meta: {
        query,
        limit,
        count: memories.length,
      },
    });
  } catch (error) {
    console.error("[/api/memories/relevant] GET error", error);
    return NextResponse.json({ error: "Erro ao buscar memorias relevantes." }, { status: 500 });
  }
}

