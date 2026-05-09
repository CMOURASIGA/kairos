import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { updateMemory } from "@/services/memory-service";

type RouteContext = {
  params: Promise<{
    memoryId: string;
  }>;
};

type FeedbackPayload = {
  feedback: "useful" | "not_useful";
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const { memoryId } = await context.params;
    if (!memoryId?.trim()) {
      return NextResponse.json({ error: "memoryId obrigatorio." }, { status: 400 });
    }

    const body = (await request.json()) as FeedbackPayload;
    if (!body?.feedback || !["useful", "not_useful"].includes(body.feedback)) {
      return NextResponse.json({ error: "Feedback invalido." }, { status: 400 });
    }

    const updated = await updateMemory({
      userId: auth.context.userId,
      memoryId,
      type: body.feedback === "useful" ? "useful_feedback" : "not_useful_feedback",
      priority: body.feedback === "useful" ? "P1" : "P4",
    });

    if (!updated) {
      return NextResponse.json({ error: "Memoria nao encontrada." }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[/api/memories/:id/feedback] POST error", error);
    return NextResponse.json({ error: "Erro ao registrar feedback." }, { status: 500 });
  }
}
