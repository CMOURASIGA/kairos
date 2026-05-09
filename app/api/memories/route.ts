import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { listMemories, saveMemory } from "@/services/memory-service";

type CreateMemoryPayload = {
  content: string;
  priority?: "P0" | "P1" | "P2" | "P3" | "P4";
  type?: string;
};

function isValidPriority(value?: string): value is "P0" | "P1" | "P2" | "P3" | "P4" {
  return value === undefined || ["P0", "P1", "P2", "P3", "P4"].includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const memories = await listMemories(auth.context.userId);
    return NextResponse.json({ data: memories });
  } catch (error) {
    console.error("[/api/memories] GET error", error);
    return NextResponse.json({ error: "Erro ao listar memorias." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as CreateMemoryPayload;
    if (!body.content?.trim()) {
      return NextResponse.json({ error: "Campo 'content' obrigatorio." }, { status: 400 });
    }
    if (!isValidPriority(body.priority)) {
      return NextResponse.json({ error: "Prioridade invalida." }, { status: 400 });
    }

    const memory = await saveMemory({
      userId: auth.context.userId,
      content: body.content.trim(),
      priority: body.priority ?? "P2",
      type: body.type?.trim() || "manual",
    });

    return NextResponse.json({ data: memory }, { status: 201 });
  } catch (error) {
    console.error("[/api/memories] POST error", error);
    return NextResponse.json({ error: "Erro ao criar memoria." }, { status: 500 });
  }
}
