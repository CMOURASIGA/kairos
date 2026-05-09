import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { runMemoryCompression } from "@/services/memory-service";

type CompressPayload = {
  force?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as CompressPayload;
    const result = await runMemoryCompression(auth.context.userId, {
      force: Boolean(body.force),
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[/api/memories/compress] POST error", error);
    return NextResponse.json({ error: "Erro ao comprimir memorias." }, { status: 500 });
  }
}
