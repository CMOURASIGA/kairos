import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { updateMemory } from "@/services/memory-service";

type RouteContext = {
  params: Promise<{
    memoryId: string;
  }>;
};

type UpdateMemoryPayload = {
  content?: string;
  priority?: "P0" | "P1" | "P2" | "P3" | "P4";
  type?: string;
};

function isValidPriority(value?: string): value is "P0" | "P1" | "P2" | "P3" | "P4" {
  return value === undefined || ["P0", "P1", "P2", "P3", "P4"].includes(value);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const { memoryId } = await context.params;
    if (!memoryId?.trim()) {
      return NextResponse.json({ error: "memoryId obrigatorio." }, { status: 400 });
    }

    const body = (await request.json()) as UpdateMemoryPayload;
    if (!isValidPriority(body.priority)) {
      return NextResponse.json({ error: "Prioridade invalida." }, { status: 400 });
    }

    const updated = await updateMemory({
      userId: auth.context.userId,
      memoryId,
      content: body.content?.trim(),
      priority: body.priority,
      type: body.type?.trim(),
    });

    if (!updated) {
      return NextResponse.json({ error: "Memoria nao encontrada." }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[/api/memories/:id] PATCH error", error);
    return NextResponse.json({ error: "Erro ao atualizar memoria." }, { status: 500 });
  }
}
