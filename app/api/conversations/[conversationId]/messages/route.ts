import { NextRequest, NextResponse } from "next/server";
import { listMessages } from "@/services/chat-store";
import { requireApiAuth } from "@/lib/api-auth";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const { conversationId } = await context.params;
    if (!conversationId?.trim()) {
      return NextResponse.json({ error: "conversationId obrigatorio." }, { status: 400 });
    }

    const messages = await listMessages({
      conversationId,
      userId: auth.context.userId,
    });
    return NextResponse.json({ data: messages });
  } catch (error) {
    console.error("[/api/conversations/:id/messages] error", error);
    return NextResponse.json({ error: "Erro ao listar mensagens." }, { status: 500 });
  }
}
