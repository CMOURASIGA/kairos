import { getOpenAIClient } from "@/lib/openai";

type GenerateOpenAITTSInput = {
  text: string;
};

type GenerateOpenAITTSOutput = {
  audioBuffer: ArrayBuffer;
  contentType: string;
};

function getTTSConfig() {
  const model = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
  const voice = process.env.OPENAI_TTS_VOICE?.trim() || "sage";
  return { model, voice };
}

export async function generateOpenAITTS(
  input: GenerateOpenAITTSInput,
): Promise<GenerateOpenAITTSOutput> {
  const text = input.text?.trim();
  if (!text) {
    throw new Error("Texto obrigatorio para gerar audio.");
  }

  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("OPENAI_API_KEY nao configurada.");
  }

  const { model, voice } = getTTSConfig();
  const response = await openai.audio.speech.create({
    model,
    voice: voice as never,
    input: text,
    response_format: "mp3",
  });

  return {
    audioBuffer: await response.arrayBuffer(),
    contentType: "audio/mpeg",
  };
}
