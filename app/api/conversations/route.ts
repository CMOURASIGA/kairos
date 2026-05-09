import { NextRequest, NextResponse } from "next/server";
import { listConversations } from "@/services/chat-store";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const conversations = await listConversations(auth.context.userId);
    return NextResponse.json({ data: conversations });
  } catch (error) {
    console.error("[/api/conversations] error", error);
    return NextResponse.json({ error: "Erro ao listar conversas." }, { status: 500 });
  }
}
