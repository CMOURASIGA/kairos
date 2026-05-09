import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateTextEmbedding, toVectorLiteral } from "@/services/embedding-service";
import { getOpenAIClient } from "@/lib/openai";
import {
  MemoryCompressionResult,
  MemoryPriority,
  MemoryPriorityMaintenanceResult,
  MemoryRecord,
} from "@/types/memory";

export type { MemoryPriority, MemoryRecord } from "@/types/memory";

const memoryStore = new Map<string, MemoryRecord[]>();
const MEMORY_COMPRESSION_MAX_ACTIVE = Number(process.env.KAIROS_MEMORY_COMPRESSION_MAX_ACTIVE ?? 120);
const MEMORY_COMPRESSION_TARGET_ACTIVE = Number(process.env.KAIROS_MEMORY_COMPRESSION_TARGET_ACTIVE ?? 80);
const MEMORY_COMPRESSION_MIN_BATCH = Number(process.env.KAIROS_MEMORY_COMPRESSION_MIN_BATCH ?? 10);
const MEMORY_COMPRESSION_MAX_BATCH = Number(process.env.KAIROS_MEMORY_COMPRESSION_MAX_BATCH ?? 30);
const MEMORY_PRIORITY_STALE_DAYS = Number(process.env.KAIROS_PRIORITY_STALE_DAYS ?? 30);
const MEMORY_PRIORITY_BATCH_LIMIT = Number(process.env.KAIROS_PRIORITY_BATCH_LIMIT ?? 120);

type MemoryRow = {
  id: string;
  user_id: string;
  tipo: string;
  prioridade: string;
  conteudo: string;
  created_at: string;
};

function mapMemoryRow(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.tipo,
    priority: row.prioridade as MemoryPriority,
    content: row.conteudo,
    createdAt: row.created_at,
  };
}

function scoreByTerms(content: string, terms: string[]): number {
  const normalized = content.toLowerCase();
  return terms.reduce((total, term) => (normalized.includes(term) ? total + 1 : total), 0);
}

function isCriticalMemory(memory: MemoryRecord): boolean {
  return (
    memory.priority === "P0" ||
    memory.priority === "P1" ||
    memory.type === "fixed" ||
    memory.type === "useful_feedback"
  );
}

function isArchivedMemory(memory: MemoryRecord): boolean {
  return memory.type === "compressed_source";
}

function isCompressionCandidate(memory: MemoryRecord): boolean {
  if (isCriticalMemory(memory)) return false;
  if (memory.type === "compressed_summary") return false;
  if (memory.type === "compressed_source") return false;
  return true;
}

function isRetrievalEligible(memory: MemoryRecord): boolean {
  return !isArchivedMemory(memory) && memory.priority !== "P4";
}

function ageInDays(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
}

const CRITICAL_KEYWORDS = [
  "credencial",
  "senha",
  "token",
  "incidente grave",
  "bloqueio critico",
  "objetivo anual",
  "decisao estrategica",
];

const HIGH_PRIORITY_KEYWORDS = [
  "risco",
  "deadline",
  "prazo",
  "decisao",
  "bloqueio",
  "urgente",
  "incidente",
  "follow-up",
  "acao imediata",
];

const LOW_SIGNAL_PATTERNS = [
  "ok",
  "feito",
  "sem novidades",
  "teste",
  "mensagem curta",
  "fallback",
];

export function suggestPriorityForMemory(memory: MemoryRecord): {
  priority: MemoryPriority;
  suggestedType?: string;
  reason: string;
} {
  const content = memory.content.toLowerCase();
  const ageDays = ageInDays(memory.createdAt);

  if (memory.type === "fixed" || memory.priority === "P0") {
    return { priority: "P0", suggestedType: "fixed", reason: "fixed_or_p0" };
  }

  if (memory.type === "compressed_source" || memory.type === "obsolete") {
    return { priority: "P4", suggestedType: "compressed_source", reason: "already_archived" };
  }

  if (memory.type === "not_useful_feedback") {
    return { priority: "P4", suggestedType: "obsolete", reason: "explicit_not_useful_feedback" };
  }

  if (memory.type === "useful_feedback") {
    return { priority: "P1", suggestedType: "useful_feedback", reason: "explicit_useful_feedback" };
  }

  if (CRITICAL_KEYWORDS.some((item) => content.includes(item))) {
    return { priority: "P0", reason: "critical_keyword" };
  }

  if (HIGH_PRIORITY_KEYWORDS.some((item) => content.includes(item))) {
    return { priority: "P1", reason: "high_priority_keyword" };
  }

  const lowSignal = LOW_SIGNAL_PATTERNS.some((item) => content.includes(item)) || content.length < 25;
  if (lowSignal && ageDays >= MEMORY_PRIORITY_STALE_DAYS) {
    return { priority: "P4", suggestedType: "obsolete", reason: "stale_low_signal" };
  }

  if (memory.type === "compressed_summary") {
    return { priority: "P3", reason: "compressed_summary" };
  }

  return { priority: "P2", reason: "default_active_context" };
}

async function buildCompressionSummary(memories: MemoryRecord[]): Promise<string> {
  const header = "Resumo de memorias operacionais antigas comprimidas automaticamente.";
  const sample = memories.slice(0, 35);
  const openai = getOpenAIClient();

  if (!openai) {
    const fallback = sample.map((item, index) => `${index + 1}. ${item.content}`).join("\n");
    return `${header}\n\n${fallback}`;
  }

  const model = process.env.KAIROS_MEMORY_COMPRESSION_MODEL?.trim() || "gpt-4o-mini";
  const inputText = sample
    .map((item, index) => `${index + 1}. [${item.priority}] (${item.type}) ${item.content}`)
    .join("\n");

  try {
    const response = await openai.responses.create({
      model,
      instructions: [
        "Voce deve sumarizar memorias operacionais em portugues do Brasil.",
        "Responda de forma curta e estruturada para reduzir custo de contexto.",
        "Preserve fatos acionaveis, decisoes, riscos e pendencias relevantes.",
      ].join(" "),
      input: `Memorias para compressao:\n${inputText}`,
    });

    const summary = response.output_text?.trim();
    if (summary) {
      return `${header}\n\n${summary}`;
    }
  } catch (error) {
    console.error("[memory-service] compression summary generation failed", error);
  }

  const fallback = sample.map((item, index) => `${index + 1}. ${item.content}`).join("\n");
  return `${header}\n\n${fallback}`;
}

export async function saveMemory(
  input: Omit<MemoryRecord, "id" | "createdAt">,
  options?: { skipCompression?: boolean },
): Promise<MemoryRecord> {
  const supabase = getSupabaseServerClient();
  const embedding = await generateTextEmbedding(input.content);
  let savedRecord: MemoryRecord | null = null;

  if (supabase) {
    try {
      const insertPayload: {
        user_id: string;
        tipo: string;
        prioridade: MemoryPriority;
        conteudo: string;
        embedding?: string;
      } = {
        user_id: input.userId,
        tipo: input.type,
        prioridade: input.priority,
        conteudo: input.content,
      };

      if (embedding?.length) {
        insertPayload.embedding = toVectorLiteral(embedding);
      }

      const inserted = await supabase
        .from("memories")
        .insert(insertPayload)
        .select("id, user_id, tipo, prioridade, conteudo, created_at")
        .single();

      if (!inserted.error && inserted.data) {
        savedRecord = mapMemoryRow(inserted.data);
      }
    } catch {
      // fallback local below
    }
  }

  if (!savedRecord) {
    savedRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    const current = memoryStore.get(input.userId) ?? [];
    current.unshift(savedRecord);
    memoryStore.set(input.userId, current.slice(0, 400));
  }

  if (!options?.skipCompression) {
    try {
      await runMemoryCompression(input.userId);
    } catch (error) {
      console.error("[memory-service] auto compression failed", error);
    }
  }

  return savedRecord;
}

export async function listMemories(userId: string): Promise<MemoryRecord[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const result = await supabase
        .from("memories")
        .select("id, user_id, tipo, prioridade, conteudo, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(400);

      if (!result.error && result.data) {
        return result.data.map(mapMemoryRow);
      }
    } catch {
      // fallback local below
    }
  }

  return memoryStore.get(userId) ?? [];
}

async function semanticSearchMemories(
  userId: string,
  query: string,
  limit: number,
): Promise<MemoryRecord[] | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const embedding = await generateTextEmbedding(query);
  if (!embedding?.length) return null;

  try {
    const result = await supabase.rpc("match_memories", {
      user_uuid: userId,
      query_embedding: toVectorLiteral(embedding),
      match_threshold: 0.45,
      match_count: limit,
    });

    if (result.error || !result.data) return null;
    const rows = result.data as MemoryRow[];
    return rows.map(mapMemoryRow);
  } catch {
    return null;
  }
}

export async function searchRelevantMemories(
  userId: string,
  query: string,
  limit = 5,
): Promise<MemoryRecord[]> {
  const semanticMatches = await semanticSearchMemories(userId, query, limit);
  if (semanticMatches && semanticMatches.length > 0) {
    return semanticMatches.filter(isRetrievalEligible).slice(0, limit);
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const memories = await listMemories(userId);

  return memories
    .filter(isRetrievalEligible)
    .map((record) => ({
      record,
      score: scoreByTerms(record.content, terms),
    }))
    .filter((item) => item.score > 0 || item.record.priority === "P0" || item.record.priority === "P1")
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.record);
}

export async function updateMemory(params: {
  userId: string;
  memoryId: string;
  content?: string;
  priority?: MemoryPriority;
  type?: string;
}): Promise<MemoryRecord | null> {
  const supabase = getSupabaseServerClient();
  const shouldRegenerateEmbedding = typeof params.content === "string";
  const updatedEmbedding = shouldRegenerateEmbedding
    ? await generateTextEmbedding(params.content ?? "")
    : null;

  if (supabase) {
    try {
      const patch: {
        conteudo?: string;
        prioridade?: MemoryPriority;
        tipo?: string;
        embedding?: string;
      } = {};

      if (params.content !== undefined) patch.conteudo = params.content;
      if (params.priority !== undefined) patch.prioridade = params.priority;
      if (params.type !== undefined) patch.tipo = params.type;
      if (updatedEmbedding?.length) patch.embedding = toVectorLiteral(updatedEmbedding);

      const updated = await supabase
        .from("memories")
        .update(patch)
        .eq("id", params.memoryId)
        .eq("user_id", params.userId)
        .select("id, user_id, tipo, prioridade, conteudo, created_at")
        .single();

      if (!updated.error && updated.data) {
        return mapMemoryRow(updated.data);
      }
    } catch {
      // fallback local below
    }
  }

  const local = memoryStore.get(params.userId) ?? [];
  const target = local.find((item) => item.id === params.memoryId);
  if (!target) return null;

  if (params.content !== undefined) target.content = params.content;
  if (params.priority !== undefined) target.priority = params.priority;
  if (params.type !== undefined) target.type = params.type;
  return target;
}

export async function runMemoryCompression(
  userId: string,
  options?: { force?: boolean },
): Promise<MemoryCompressionResult> {
  const force = Boolean(options?.force);
  const memories = await listMemories(userId);
  const activeMemories = memories.filter(isRetrievalEligible);

  if (!force && activeMemories.length <= MEMORY_COMPRESSION_MAX_ACTIVE) {
    return { compressed: false, archivedCount: 0, reason: "below_threshold" };
  }

  const candidates = memories
    .filter(isCompressionCandidate)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  if (candidates.length < MEMORY_COMPRESSION_MIN_BATCH) {
    return { compressed: false, archivedCount: 0, reason: "not_enough_candidates" };
  }

  const overage = Math.max(activeMemories.length - MEMORY_COMPRESSION_TARGET_ACTIVE, 0);
  const desired = force ? MEMORY_COMPRESSION_MAX_BATCH : Math.max(overage, MEMORY_COMPRESSION_MIN_BATCH);
  const batchSize = Math.min(candidates.length, desired, MEMORY_COMPRESSION_MAX_BATCH);
  const selected = candidates.slice(0, batchSize);

  if (selected.length === 0) {
    return { compressed: false, archivedCount: 0, reason: "empty_batch" };
  }

  const summary = await buildCompressionSummary(selected);
  const summaryMemory = await saveMemory(
    {
      userId,
      type: "compressed_summary",
      priority: "P3",
      content: summary,
    },
    { skipCompression: true },
  );

  const selectedIds = selected.map((item) => item.id);
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      await supabase
        .from("memories")
        .update({
          tipo: "compressed_source",
          prioridade: "P4",
        })
        .eq("user_id", userId)
        .in("id", selectedIds);
    } catch {
      // fallback local below
    }
  }

  const local = memoryStore.get(userId) ?? [];
  for (const memory of local) {
    if (selectedIds.includes(memory.id)) {
      memory.type = "compressed_source";
      memory.priority = "P4";
    }
  }

  return {
    compressed: true,
    archivedCount: selected.length,
    summaryMemoryId: summaryMemory.id,
  };
}

export async function runMemoryPriorityMaintenance(
  userId: string,
  options?: { limit?: number },
): Promise<MemoryPriorityMaintenanceResult> {
  const limit = Math.max(1, Math.min(options?.limit ?? MEMORY_PRIORITY_BATCH_LIMIT, 500));
  const memories = (await listMemories(userId)).slice(0, limit);

  let changed = 0;
  let discarded = 0;
  let fixed = 0;
  let highPriority = 0;

  for (const memory of memories) {
    if (memory.type === "compressed_source") continue;

    const suggestion = suggestPriorityForMemory(memory);
    const nextPriority = suggestion.priority;
    const nextType = suggestion.suggestedType;

    const typeChanged = nextType !== undefined && nextType !== memory.type;
    const priorityChanged = nextPriority !== memory.priority;
    if (!typeChanged && !priorityChanged) continue;

    await updateMemory({
      userId,
      memoryId: memory.id,
      priority: nextPriority,
      type: nextType ?? memory.type,
    });

    changed += 1;
    if (nextPriority === "P4") discarded += 1;
    if (nextPriority === "P0") fixed += 1;
    if (nextPriority === "P1") highPriority += 1;
  }

  return {
    processed: memories.length,
    changed,
    discarded,
    fixed,
    highPriority,
  };
}
