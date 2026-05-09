import { listMemories } from "@/services/memory-service";
import { listDecisions } from "@/services/decision-service";
import { validateServerEnv } from "@/lib/env";
import { getOpenAIClient } from "@/lib/openai";
import { listGoogleCalendarEvents } from "@/services/integrations/google-calendar-service";
import { listAzureDevOpsWorkItems } from "@/services/integrations/azure-devops-service";

type DailySnapshot = {
  summary: string;
  priorities: string[];
  pendings: string[];
  agenda: string[];
  risks: string[];
  suggestions: string[];
  smartQuestions: string[];
};

const defaultDaily: DailySnapshot = {
  summary:
    "Sem dados operacionais recentes suficientes. Use o chat para registrar decisoes e memórias do dia.",
  priorities: [
    "Concluir fluxo principal Core + Chat + Memoria",
    "Revisar backlog da fase atual",
    "Registrar decisoes operacionais do dia",
  ],
  pendings: ["Configurar chaves de ambiente", "Conectar projeto ao Supabase", "Validar modelo OpenAI"],
  agenda: [
    "Manha: revisar pendencias e bloquear riscos operacionais",
    "Meio do dia: executar item de maior prioridade",
    "Fim do dia: registrar decisoes e atualizar memoria",
  ],
  risks: [
    "Dependencias externas nao configuradas podem bloquear testes integrados",
    "Memoria em modo in-memory nao persiste entre reinicios",
  ],
  suggestions: [
    "Definir um objetivo operacional unico para o dia",
    "Registrar ao menos uma decisao com contexto e impacto",
    "Fechar o dia atualizando pendencias e riscos",
  ],
  smartQuestions: [
    "Alguma prioridade mudou desde ontem?",
    "Qual decisao precisa ser registrada hoje?",
    "Existe tarefa critica sem dono definido?",
  ],
};

const STATUS_LABEL: Record<string, string> = {
  aberta: "aberta",
  em_andamento: "em andamento",
  concluida: "concluida",
  cancelada: "cancelada",
};

function trimText(value: string, max = 140): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

function normalizeList(items: unknown, fallback: string[], size = 3): string[] {
  if (!Array.isArray(items)) return fallback.slice(0, size);
  const cleaned = items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, size);
  if (cleaned.length === 0) return fallback.slice(0, size);
  if (cleaned.length < size) {
    return [...cleaned, ...fallback].slice(0, size);
  }
  return cleaned;
}

async function buildCalendarAgendaContext(): Promise<{ agendaItems: string[]; hasEvents: boolean }> {
  try {
    const events = await listGoogleCalendarEvents({ limit: 2, daysAhead: 2 });
    if (!events.length) return { agendaItems: [], hasEvents: false };

    const agendaItems = events.map((event) => {
      const timePart = event.isAllDay ? "Dia todo" : event.dateLabel;
      return `Calendario: ${timePart} - ${trimText(event.title, 80)}`;
    });

    return { agendaItems, hasEvents: true };
  } catch {
    return { agendaItems: [], hasEvents: false };
  }
}

async function buildAzureDevOpsContext(): Promise<{ pendings: string[]; summaryNote: string }> {
  try {
    const items = await listAzureDevOpsWorkItems({ limit: 2, onlyOpen: true });
    if (!items.length) {
      return { pendings: [], summaryNote: "" };
    }

    const pendings = items.map((item) => {
      const owner = item.assignedTo && item.assignedTo !== "Nao atribuido" ? item.assignedTo : "sem owner";
      return `Azure DevOps: #${item.id} (${item.project}) ${trimText(item.title, 80)} - ${item.state} - ${owner}`;
    });

    return {
      pendings,
      summaryNote: `${items.length} work item(ns) aberto(s) no Azure DevOps.`,
    };
  } catch {
    return { pendings: [], summaryNote: "" };
  }
}

function buildRuleBasedSnapshot(params: {
  memories: Awaited<ReturnType<typeof listMemories>>;
  decisions: Awaited<ReturnType<typeof listDecisions>>;
  missingEnvKeys: string[];
}): DailySnapshot {
  const { memories, decisions, missingEnvKeys } = params;
  const openDecisions = decisions.filter(
    (item) => item.status === "aberta" || item.status === "em_andamento",
  );
  const criticalMemories = memories.filter((item) => item.priority === "P0" || item.priority === "P1");

  const memoryPriority = memories[0]?.content
    ? `Memoria ativa: ${trimText(memories[0].content)}`
    : "Sem memoria recente priorizada.";
  const decisionPriority = decisions[0]?.title
    ? `Decisao em foco: ${trimText(decisions[0].title)}`
    : "Sem decisao registrada recentemente.";

  const pendingsFromDecisions = openDecisions
    .slice(0, 2)
    .map((item) => `Acompanhar decisao "${trimText(item.title, 90)}" (${STATUS_LABEL[item.status] ?? item.status})`);
  const pendings =
    pendingsFromDecisions.length > 0
      ? [...pendingsFromDecisions, defaultDaily.pendings[0], defaultDaily.pendings[1]]
      : defaultDaily.pendings;

  const agendaFromDecisions = openDecisions
    .slice(0, 2)
    .map((item) => `Follow-up de decisao: ${trimText(item.title, 90)}`);
  const agendaFromMemories = criticalMemories
    .slice(0, 1)
    .map((item) => `Tratar memoria ${item.priority}: ${trimText(item.content, 90)}`);
  const agenda = [...agendaFromDecisions, ...agendaFromMemories, defaultDaily.agenda[2]].slice(0, 3);

  const risksFromEnv = missingEnvKeys.map(
    (key) => `Dependencia externa sem configuracao: ${key}`,
  );
  const risksFromContext = memories
    .filter((item) => /\brisco\b|\bbloqueio\b|\bdependenc/i.test(item.content))
    .slice(0, 2)
    .map((item) => `Sinal de risco em memoria (${item.priority}): ${trimText(item.content, 90)}`);
  const risks = [...risksFromEnv, ...risksFromContext, defaultDaily.risks[1]].slice(0, 3);

  const suggestions = [
    openDecisions[0]
      ? `Definir owner e prazo para "${trimText(openDecisions[0].title, 70)}".`
      : "Registrar uma decisao operacional com proximo passo claro.",
    criticalMemories[0]
      ? `Converter memoria ${criticalMemories[0].priority} em acao com prazo hoje.`
      : "Priorizar uma memoria util e transformar em tarefa concreta.",
    missingEnvKeys[0]
      ? `Resolver configuracao de ambiente pendente: ${missingEnvKeys[0]}.`
      : "Revisar riscos externos e confirmar mitigacoes ativas.",
  ];

  const smartQuestions = [
    openDecisions[0]
      ? `Qual proximo passo para destravar "${trimText(openDecisions[0].title, 70)}" hoje?`
      : defaultDaily.smartQuestions[0],
    criticalMemories[0]
      ? `Como reduzir o risco associado a memoria ${criticalMemories[0].priority}?`
      : defaultDaily.smartQuestions[1],
    missingEnvKeys[0]
      ? `Quem fica responsavel por configurar ${missingEnvKeys[0]} ainda hoje?`
      : defaultDaily.smartQuestions[2],
  ];

  const summaryParts = [
    openDecisions.length > 0 ? `${openDecisions.length} decisoes abertas/em andamento` : "sem decisoes abertas",
    criticalMemories.length > 0 ? `${criticalMemories.length} memorias criticas ativas` : "sem memorias criticas",
    missingEnvKeys.length > 0 ? `${missingEnvKeys.length} dependencias externas pendentes` : "ambiente principal configurado",
  ];

  return {
    summary: `Panorama automatico: ${summaryParts.join(", ")}.`,
    priorities: [defaultDaily.priorities[0], memoryPriority, decisionPriority],
    pendings,
    agenda: agenda.length > 0 ? agenda : defaultDaily.agenda,
    risks: risks.length > 0 ? risks : defaultDaily.risks,
    suggestions,
    smartQuestions,
  };
}

async function enhanceSnapshotWithAI(params: {
  baseSnapshot: DailySnapshot;
  memories: Awaited<ReturnType<typeof listMemories>>;
  decisions: Awaited<ReturnType<typeof listDecisions>>;
  missingEnvKeys: string[];
}): Promise<DailySnapshot> {
  const openai = getOpenAIClient();
  if (!openai) return params.baseSnapshot;

  const model = process.env.KAIROS_DAILY_MODEL?.trim() || "gpt-4o-mini";
  const projects = Array.from(
    new Set(params.decisions.map((item) => item.projectId).filter(Boolean)),
  );
  const payload = {
    memories: params.memories.slice(0, 8).map((item) => ({
      priority: item.priority,
      type: item.type,
      content: item.content,
      createdAt: item.createdAt,
    })),
    decisions: params.decisions.slice(0, 8).map((item) => ({
      title: item.title,
      status: item.status,
      projectId: item.projectId,
      impact: item.impact,
      createdAt: item.createdAt,
    })),
    projects,
    missingEnvKeys: params.missingEnvKeys,
    baseline: params.baseSnapshot,
  };

  try {
    const response = await openai.responses.create({
      model,
      instructions: [
        "Voce gera daily operacional em portugues do Brasil.",
        "Responda apenas JSON valido, sem markdown.",
        "Nao invente fatos fora do contexto recebido.",
        "Mantenha frases curtas, acionaveis e objetivas.",
      ].join(" "),
      input: [
        "Produza um objeto JSON com os campos:",
        "summary (string), priorities (3), pendings (3), agenda (3), risks (3), suggestions (3), smartQuestions (3).",
        `Contexto: ${JSON.stringify(payload)}`,
      ].join("\n"),
    });

    const raw = response.output_text?.trim();
    if (!raw) return params.baseSnapshot;

    const parsed = JSON.parse(raw) as Partial<DailySnapshot>;
    return {
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : params.baseSnapshot.summary,
      priorities: normalizeList(parsed.priorities, params.baseSnapshot.priorities),
      pendings: normalizeList(parsed.pendings, params.baseSnapshot.pendings),
      agenda: normalizeList(parsed.agenda, params.baseSnapshot.agenda),
      risks: normalizeList(parsed.risks, params.baseSnapshot.risks),
      suggestions: normalizeList(parsed.suggestions, params.baseSnapshot.suggestions),
      smartQuestions: normalizeList(parsed.smartQuestions, params.baseSnapshot.smartQuestions),
    };
  } catch (error) {
    console.error("[daily-service] AI daily generation failed", error);
    return params.baseSnapshot;
  }
}

export async function getDailySnapshot(userId: string): Promise<DailySnapshot> {
  const memories = (await listMemories(userId)).slice(0, 8);
  const decisions = (await listDecisions(userId)).slice(0, 8);
  const missingEnvKeys = validateServerEnv();
  const calendarContext = await buildCalendarAgendaContext();
  const azureContext = await buildAzureDevOpsContext();

  if (!memories.length && !decisions.length) {
    if (!calendarContext.hasEvents) return defaultDaily;
    return {
      ...defaultDaily,
      summary: `${defaultDaily.summary} Agenda sincronizada com compromissos do Google Calendar.`,
      agenda: [...calendarContext.agendaItems, ...defaultDaily.agenda].slice(0, 3),
    };
  }

  const baseSnapshot = buildRuleBasedSnapshot({ memories, decisions, missingEnvKeys });
  const agendaWithCalendar = calendarContext.agendaItems.length
    ? [...calendarContext.agendaItems, ...baseSnapshot.agenda].slice(0, 3)
    : baseSnapshot.agenda;

  const summaryWithCalendar = calendarContext.hasEvents
    ? `${baseSnapshot.summary} Agenda sincronizada com compromissos do Google Calendar.`
    : baseSnapshot.summary;

  const pendingsWithAzure = azureContext.pendings.length
    ? [...azureContext.pendings, ...baseSnapshot.pendings].slice(0, 3)
    : baseSnapshot.pendings;

  const summaryWithIntegrations = azureContext.summaryNote
    ? `${summaryWithCalendar} ${azureContext.summaryNote}`
    : summaryWithCalendar;

  const snapshotWithCalendar: DailySnapshot = {
    ...baseSnapshot,
    summary: summaryWithIntegrations,
    agenda: agendaWithCalendar,
    pendings: pendingsWithAzure,
  };

  return enhanceSnapshotWithAI({
    baseSnapshot: snapshotWithCalendar,
    memories,
    decisions,
    missingEnvKeys,
  });
}
