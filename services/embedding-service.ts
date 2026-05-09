import { getOpenAIClient } from "@/lib/openai";

export async function generateTextEmbedding(input: string): Promise<number[] | null> {
  const text = input.trim();
  if (!text) return null;

  const openai = getOpenAIClient();
  if (!openai) return null;

  const model = process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";

  try {
    const response = await openai.embeddings.create({
      model,
      input: text,
      encoding_format: "float",
    });

    const embedding = response.data?.[0]?.embedding;
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      return null;
    }

    return embedding;
  } catch (error) {
    console.error("[embedding-service] failed to generate embedding", error);
    return null;
  }
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
