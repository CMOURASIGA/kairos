import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CreateDecisionInput, Decision, DecisionStatus } from "@/types/decision";

const decisionStore = new Map<string, Decision[]>();

function normalizeStatus(status?: string): DecisionStatus {
  if (status === "em_andamento" || status === "concluida" || status === "cancelada") return status;
  return "aberta";
}

type DecisionRowBase = {
  id: string;
  user_id: string;
  titulo: string;
  motivo: string | null;
  impacto: string | null;
  status: string;
  project_id: string | null;
  created_at: string;
};

type DecisionRowWithContext = DecisionRowBase & {
  contexto?: string | null;
};

function extractContextFromReason(rawReason: string): { context: string; reason: string } {
  const normalized = rawReason.trimStart();
  const lines = normalized.split(/\r?\n/);
  const firstLine = (lines[0] ?? "").trim();
  const match = firstLine.match(/^contexto:\s*(.*)$/i);
  if (!match) {
    return { context: "", reason: rawReason };
  }

  const context = (match[1] ?? "").trim();
  const reason = lines.slice(1).join("\n").trim();
  return { context, reason };
}

function mapSupabaseDecision(item: DecisionRowWithContext): Decision {
  const parsed = extractContextFromReason(item.motivo ?? "");
  const context = item.contexto ?? parsed.context;
  const reason = item.motivo ? (item.contexto ? item.motivo : parsed.reason) : "";

  return {
    id: item.id,
    userId: item.user_id,
    title: item.titulo,
    context,
    reason,
    impact: item.impacto ?? "",
    status: normalizeStatus(item.status),
    projectId: item.project_id,
    createdAt: item.created_at,
  };
}

function saveLocalDecision(input: CreateDecisionInput): Decision {
  const decision: Decision = {
    id: crypto.randomUUID(),
    userId: input.userId,
    title: input.title.trim(),
    context: input.context?.trim() ?? "",
    reason: input.reason?.trim() ?? "",
    impact: input.impact?.trim() ?? "",
    status: normalizeStatus(input.status),
    projectId: input.projectId ?? null,
    createdAt: new Date().toISOString(),
  };

  const current = decisionStore.get(input.userId) ?? [];
  current.unshift(decision);
  decisionStore.set(input.userId, current.slice(0, 300));
  return decision;
}

async function createDecisionWithContextColumn(input: CreateDecisionInput): Promise<Decision | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const inserted = await supabase
    .from("decisions")
    .insert({
      user_id: input.userId,
      titulo: input.title.trim(),
      contexto: input.context?.trim() ?? null,
      motivo: input.reason?.trim() ?? null,
      impacto: input.impact?.trim() ?? null,
      status: normalizeStatus(input.status),
      project_id: input.projectId ?? null,
    })
    .select("id, user_id, titulo, contexto, motivo, impacto, status, project_id, created_at")
    .single();

  if (inserted.error || !inserted.data) return null;
  return mapSupabaseDecision(inserted.data);
}

async function createDecisionLegacy(input: CreateDecisionInput): Promise<Decision | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const motivo = input.context?.trim()
    ? `Contexto: ${input.context.trim()}\n${input.reason?.trim() ?? ""}`.trim()
    : input.reason?.trim() ?? null;

  const inserted = await supabase
    .from("decisions")
    .insert({
      user_id: input.userId,
      titulo: input.title.trim(),
      motivo,
      impacto: input.impact?.trim() ?? null,
      status: normalizeStatus(input.status),
      project_id: input.projectId ?? null,
    })
    .select("id, user_id, titulo, motivo, impacto, status, project_id, created_at")
    .single();

  if (inserted.error || !inserted.data) return null;
  return mapSupabaseDecision(inserted.data);
}

export async function createDecision(input: CreateDecisionInput): Promise<Decision> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const withContext = await createDecisionWithContextColumn(input);
      if (withContext) return withContext;
    } catch {
      // fallback legacy below
    }

    try {
      const legacy = await createDecisionLegacy(input);
      if (legacy) return legacy;
    } catch {
      // fallback local below
    }
  }

  return saveLocalDecision(input);
}

async function listDecisionsWithContextColumn(userId: string): Promise<Decision[] | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const result = await supabase
    .from("decisions")
    .select("id, user_id, titulo, contexto, motivo, impacto, status, project_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (result.error || !result.data) return null;
  return result.data.map(mapSupabaseDecision);
}

async function listDecisionsLegacy(userId: string): Promise<Decision[] | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const result = await supabase
    .from("decisions")
    .select("id, user_id, titulo, motivo, impacto, status, project_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (result.error || !result.data) return null;
  return (result.data as DecisionRowBase[]).map((item) => mapSupabaseDecision(item));
}

export async function listDecisions(userId: string): Promise<Decision[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const withContext = await listDecisionsWithContextColumn(userId);
      if (withContext) return withContext;
    } catch {
      // fallback legacy below
    }

    try {
      const legacy = await listDecisionsLegacy(userId);
      if (legacy) return legacy;
    } catch {
      // fallback local below
    }
  }

  return decisionStore.get(userId) ?? [];
}

export async function updateDecisionStatus(params: {
  userId: string;
  decisionId: string;
  status: DecisionStatus;
}): Promise<Decision | null> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const updated = await supabase
        .from("decisions")
        .update({ status: normalizeStatus(params.status) })
        .eq("id", params.decisionId)
        .eq("user_id", params.userId)
        .select("id, user_id, titulo, contexto, motivo, impacto, status, project_id, created_at")
        .single();

      if (!updated.error && updated.data) {
        return mapSupabaseDecision(updated.data);
      }
    } catch {
      // fallback legacy below
    }

    try {
      const updatedLegacy = await supabase
        .from("decisions")
        .update({ status: normalizeStatus(params.status) })
        .eq("id", params.decisionId)
        .eq("user_id", params.userId)
        .select("id, user_id, titulo, motivo, impacto, status, project_id, created_at")
        .single();

      if (!updatedLegacy.error && updatedLegacy.data) {
        return mapSupabaseDecision(updatedLegacy.data as DecisionRowBase);
      }
    } catch {
      // fallback local below
    }
  }

  const current = decisionStore.get(params.userId) ?? [];
  const found = current.find((item) => item.id === params.decisionId);
  if (!found) return null;

  found.status = normalizeStatus(params.status);
  return found;
}
