import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  const { OPENAI_API_KEY } = getServerEnv();
  if (!OPENAI_API_KEY) return null;

  if (!client) {
    client = new OpenAI({ apiKey: OPENAI_API_KEY });
  }

  return client;
}
