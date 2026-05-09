"use client";

import { useEffect, useState } from "react";
import { Decision, DecisionStatus } from "@/types/decision";

const STATUS_LABELS: Record<DecisionStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluida",
  cancelada: "Cancelada",
};

const STATUS_OPTIONS: DecisionStatus[] = ["aberta", "em_andamento", "concluida", "cancelada"];

export default function ProjectsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadDecisions() {
    setLoading(true);
    try {
      const response = await fetch("/api/decisions");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao carregar decisoes.");
      setDecisions((payload?.data ?? []) as Decision[]);
    } catch {
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDecisions();
  }, []);

  async function handleStatusChange(decisionId: string, status: DecisionStatus) {
    setUpdatingId(decisionId);
    try {
      const response = await fetch(`/api/decisions/${decisionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao atualizar status.");

      const updated = payload?.data as Decision;
      setDecisions((prev) => prev.map((item) => (item.id === decisionId ? updated : item)));
    } catch {
      // keep current state if request fails
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-(--text-primary)">Projetos e Decisoes</h2>
        <button
          type="button"
          onClick={() => void loadDecisions()}
          className="rounded-lg border border-(--border) bg-(--bg-surface) px-3 py-1 text-xs font-medium text-(--text-primary)"
        >
          Atualizar
        </button>
      </div>

      <p className="text-sm text-(--text-secondary)">
        Registro operacional das decisoes do Kairos PM com status e historico.
      </p>

      {loading ? (
        <div className="rounded-xl border border-(--border) bg-(--bg-surface) p-4 text-sm text-(--text-secondary)">
          Carregando decisoes...
        </div>
      ) : decisions.length === 0 ? (
        <div className="rounded-xl border border-(--border) bg-(--bg-surface) p-4 text-sm text-(--text-secondary)">
          Nenhuma decisao registrada. Use o chat PM e clique em &quot;Salvar decisao&quot;.
        </div>
      ) : (
        <div className="space-y-3">
          {decisions.map((decision) => (
            <article key={decision.id} className="rounded-xl border border-(--border) bg-(--bg-surface) p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-semibold text-(--text-primary)">{decision.title}</p>
                <select
                  value={decision.status}
                  onChange={(event) =>
                    void handleStatusChange(decision.id, event.target.value as DecisionStatus)
                  }
                  disabled={updatingId === decision.id}
                  className="rounded-md border border-(--border) bg-white px-2 py-1 text-xs text-(--text-primary)"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-sm text-(--text-secondary)">{decision.reason || "Sem motivo registrado."}</p>
              <p className="mt-1 text-sm text-(--text-secondary)">
                Contexto: {decision.context || "Nao informado."}
              </p>
              <p className="mt-1 text-sm text-(--text-secondary)">
                Projeto relacionado: {decision.projectId || "Nao informado."}
              </p>
              <p className="mt-2 text-xs text-(--text-secondary)">
                Impacto: {decision.impact || "Nao informado"} | {new Date(decision.createdAt).toLocaleString("pt-BR")}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
