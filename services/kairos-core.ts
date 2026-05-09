import { getOpenAIClient } from "@/lib/openai";
import { listMessages } from "@/services/chat-store";
import { searchRelevantMemories, saveMemory } from "@/services/memory-service";
import { SpecialistId } from "@/types/chat";

const specialistPrompts: Record<SpecialistId, string> = {
  general:
    "Voce e o Kairos Geral. Organize ideias, priorize clareza e sempre finalize com proximos passos objetivos.",
  pm: [
    "Voce e o Kairos PM.",
    "Use estrutura analitica objetiva com os blocos: Contexto, Diagnostico, Riscos, Plano, Decisoes recomendadas, Proximos passos.",
    "Quando houver ambiguidade, explicite premissas e trade-offs antes da recomendacao.",
    "Liste donos e prazo sugerido nos proximos passos sempre que possivel.",
  ].join(" "),
  study: "Voce e o Kairos Study. Explique conceitos com didatica e ajuste nivel de profundidade.",
  translate:
    "Voce e o Kairos Translate. Traduza com contexto e explique escolhas semanticas quando necessario.",
  tech: "Voce e o Kairos Tech. Responda tecnicamente com foco pratico em implementacao.",
  writer: "Voce e o Kairos Writer. Refine texto com clareza, tom e estrutura.",
  research: "Voce e o Kairos Research. Estruture investigacoes com hipoteses, evidencias e conclusao.",
};

export function classifyIntent(message: string): SpecialistId {
  const input = message.toLowerCase();
  if (/(projeto|backlog|sprint|risco|roadmap)/.test(input)) return "pm";
  if (/(estudar|resumo|explicar|prova|revisao)/.test(input)) return "study";
  if (/(traduz|translation|idioma|ingles|espanhol)/.test(input)) return "translate";
  if (/(codigo|bug|api|arquitetura|deploy)/.test(input)) return "tech";
  if (/(texto|escrever|copy|artigo|post)/.test(input)) return "writer";
  if (/(pesquisa|investigar|referencia|fontes)/.test(input)) return "research";
  return "general";
}

async function buildMemoryContext(userId: string, message: string): Promise<string> {
  const memories = await searchRelevantMemories(userId, message, 4);
  if (!memories.length) return "Sem memorias relevantes ate o momento.";

  return memories
    .map((memory, index) => `${index + 1}. [${memory.priority}] ${memory.content}`)
    .join("\n");
}

type GenerateParams = {
  userId: string;
  conversationId: string;
  message: string;
  selectedSpecialist?: SpecialistId;
};

export async function generateKairosResponse(params: GenerateParams): Promise<{
  specialist: SpecialistId;
  answer: string;
}> {
  const specialist = params.selectedSpecialist ?? classifyIntent(params.message);
  const memoryContext = await buildMemoryContext(params.userId, params.message);
  const history = (
    await listMessages({
      conversationId: params.conversationId,
      userId: params.userId,
    })
  ).slice(-8);

  const historyText = history.map((item) => `${item.role.toUpperCase()}: ${item.content}`).join("\n");

  const systemPrompt = [
    "Voce e o Kairos Core, um sistema cognitivo operacional continuo.",
    specialistPrompts[specialist],
    "Use o contexto de memoria quando for util e mantenha linguagem objetiva.",
    "Se faltar informacao, faca perguntas curtas no final.",
    specialist === "pm"
      ? "No especialista PM, seja concreto e use bullets curtos por secao."
      : "Mantenha formato enxuto e util para execucao.",
    `Memorias relevantes:\n${memoryContext}`,
  ].join("\n\n");

  const openai = getOpenAIClient();
  if (!openai) {
    const fallbackAnswer = buildLocalFallbackAnswer(specialist, params.message, "OPENAI_API_KEY nao configurada.");
    await saveMemory({
      userId: params.userId,
      type: "interaction",
      priority: "P2",
      content: `Usuario perguntou: ${params.message}`,
    });
    return { specialist, answer: fallbackAnswer };
  }

  try {
    const response = await openai.responses.create({
      model: specialist === "pm" || specialist === "tech" ? "gpt-4.1" : "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Historico recente:\n${historyText || "Sem historico"}\n\nMensagem atual:\n${params.message}`,
        },
      ],
    });

    const answer = response.output_text?.trim() || "Nao foi possivel gerar resposta.";

    await saveMemory({
      userId: params.userId,
      type: "interaction",
      priority: "P2",
      content: `Interacao ${specialist}: ${params.message}`,
    });

    return { specialist, answer };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Falha na chamada OpenAI.";
    const fallbackAnswer = buildLocalFallbackAnswer(specialist, params.message, reason);
    await saveMemory({
      userId: params.userId,
      type: "interaction",
      priority: "P2",
      content: `Fallback ${specialist}: ${params.message}`,
    });
    return { specialist, answer: fallbackAnswer };
  }
}

function buildLocalFallbackAnswer(
  specialist: SpecialistId,
  message: string,
  reason: string,
): string {
  return [
    `Especialista ativo: ${specialist.toUpperCase()}.`,
    `Resposta em modo local devido a: ${reason}`,
    `Mensagem recebida: ${message}`,
    "Proximos passos: valide OPENAI_API_KEY e conectividade de rede para resposta completa.",
  ].join("\n");
}
