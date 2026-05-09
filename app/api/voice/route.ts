import { NextRequest, NextResponse } from "next/server";
import { generateOpenAITTS } from "@/services/voice/openai-tts";
import { requireApiAuth } from "@/lib/api-auth";

type VoicePayload = {
  text: string;
};

function validatePayload(payload: VoicePayload): string | null {
  if (!payload.text?.trim()) return "Campo 'text' obrigatorio.";
  if (payload.text.trim().length > 3500) return "Texto muito longo para geracao de voz.";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as VoicePayload;
    const validationError = validatePayload(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const result = await generateOpenAITTS({
      text: body.text.trim(),
    });

    return new NextResponse(result.audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "Content-Disposition": 'inline; filename="kairos-response.mp3"',
      },
    });
  } catch (error) {
    console.error("[/api/voice] error", error);
    const message = error instanceof Error ? error.message : "Erro interno ao gerar audio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
