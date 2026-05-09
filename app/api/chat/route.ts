import { NextRequest, NextResponse } from "next/server";
import { appendMessage } from "@/services/chat-store";
import { generateKairosResponse } from "@/services/kairos-core";
import { requireApiAuth } from "@/lib/api-auth";
import { ChatPayload, SpecialistId } from "@/types/chat";

const validSpecialists: SpecialistId[] = [
  "general",
  "pm",
  "study",
  "translate",
  "tech",
  "writer",
  "research",
];

function validatePayload(payload: ChatPayload): string | null {
  if (!payload.message?.trim()) return "Campo 'message' obrigatorio.";
  if (!payload.conversationId?.trim()) return "Campo 'conversationId' obrigatorio.";
  if (payload.selectedSpecialist && !validSpecialists.includes(payload.selectedSpecialist)) {
    return "Especialista invalido.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as ChatPayload;
    const validationError = validatePayload(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const userId = auth.context.userId;
    await appendMessage({
      userId,
      conversationId: body.conversationId,
      role: "user",
      content: body.message.trim(),
      specialist: body.selectedSpecialist ?? "general",
    });

    const result = await generateKairosResponse({
      userId,
      conversationId: body.conversationId,
      message: body.message.trim(),
      selectedSpecialist: body.selectedSpecialist,
    });

    const assistantMessage = await appendMessage({
      userId,
      conversationId: body.conversationId,
      role: "assistant",
      content: result.answer,
      specialist: result.specialist,
    });

    return NextResponse.json({
      data: {
        conversationId: body.conversationId,
        specialist: result.specialist,
        message: assistantMessage,
      },
    });
  } catch (error) {
    console.error("[/api/chat] error", error);
    return NextResponse.json({ error: "Erro interno ao processar chat." }, { status: 500 });
  }
}
