"use client";

import { useEffect, useState } from "react";
import { MemoryPriority, MemoryRecord } from "@/types/memory";

const PRIORITIES: MemoryPriority[] = ["P0", "P1", "P2", "P3", "P4"];

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [prioritizing, setPrioritizing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const [priorityInfo, setPriorityInfo] = useState<string | null>(null);

  async function loadMemories() {
    setLoading(true);
    try {
      const response = await fetch("/api/memories");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao carregar memorias.");
      setMemories((payload?.data ?? []) as MemoryRecord[]);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMemories();
  }, []);

  async function runCompression(force = false) {
    setCompressing(true);
    setCompressionInfo(null);
    try {
      const response = await fetch("/api/memories/compress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Falha ao comprimir memorias.");

      const data = payload?.data as {
        compressed: boolean;
        archivedCount: number;
        summaryMemoryId?: string;
        reason?: string;
      };

      if (data.compressed) {
        setCompressionInfo(`Compressao concluida. Arquivadas: ${data.archivedCount}.`);
      } else {
        setCompressionInfo(`Sem compressao: ${data.reason ?? "criterio nao atendido"}.`);
      }
      await loadMemories();
    } catch (error) {
      setCompressionInfo(error instanceof Error ? error.message : "Falha de compressao.");
    } finally {
      setCompressing(false);
    }
  }

  async function runPriorityMaintenance() {
    setPrioritizing(true);
    setPriorityInfo(null);
    try {
      const response = await fetch("/api/memories/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Falha ao priorizar memorias.");

      const data = payload?.data as {
        processed: number;
        changed: number;
        discarded: number;
        fixed: number;
        highPriority: number;
      };

      setPriorityInfo(
        `Priorizacao concluida. Processadas: ${data.processed}, alteradas: ${data.changed}, descartadas: ${data.discarded}.`,
      );
      await loadMemories();
    } catch (error) {
      setPriorityInfo(error instanceof Error ? error.message : "Falha na priorizacao.");
    } finally {
      setPrioritizing(false);
    }
  }

  async function patchMemory(memoryId: string, body: { content?: string; priority?: MemoryPriority; type?: string }) {
    setUpdatingId(memoryId);
    try {
      const response = await fetch(`/api/memories/${memoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao atualizar memoria.");
      const updated = payload?.data as MemoryRecord;
      setMemories((prev) => prev.map((item) => (item.id === memoryId ? updated : item)));
    } catch {
      // ignore UI error details for now
    } finally {
      setUpdatingId(null);
    }
  }

  async function sendFeedback(memoryId: string, feedback: "useful" | "not_useful") {
    setUpdatingId(memoryId);
    try {
      const response = await fetch(`/api/memories/${memoryId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao registrar feedback.");
      const updated = payload?.data as MemoryRecord;
      setMemories((prev) => prev.map((item) => (item.id === memoryId ? updated : item)));
    } catch {
      // ignore UI error details for now
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleEdit(memory: MemoryRecord) {
    const nextContent = window.prompt("Editar memoria:", memory.content)?.trim();
    if (!nextContent || nextContent === memory.content) return;
    await patchMemory(memory.id, { content: nextContent });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-(--text-primary)">Memoria</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void runPriorityMaintenance()}
            disabled={prioritizing}
            className="rounded-lg border border-(--border) bg-(--bg-surface) px-3 py-1 text-xs font-medium text-(--text-primary) disabled:opacity-50"
          >
            {prioritizing ? "Priorizando..." : "Priorizar automatico"}
          </button>
          <button
            type="button"
            onClick={() => void runCompression(true)}
            disabled={compressing}
            className="rounded-lg border border-(--border) bg-(--bg-surface) px-3 py-1 text-xs font-medium text-(--text-primary) disabled:opacity-50"
          >
            {compressing ? "Comprimindo..." : "Comprimir agora"}
          </button>
          <button
            type="button"
            onClick={() => void loadMemories()}
            className="rounded-lg border border-(--border) bg-(--bg-surface) px-3 py-1 text-xs font-medium text-(--text-primary)"
          >
            Atualizar
          </button>
        </div>
      </div>

      <p className="text-sm text-(--text-secondary)">
        Governanca de memoria: editar, priorizar, fixar e marcar obsoleta.
      </p>

      {compressionInfo ? (
        <p className="rounded-lg bg-(--bg-muted) px-3 py-2 text-xs text-(--text-secondary)">{compressionInfo}</p>
      ) : null}

      {priorityInfo ? (
        <p className="rounded-lg bg-(--bg-muted) px-3 py-2 text-xs text-(--text-secondary)">{priorityInfo}</p>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-(--border) bg-(--bg-surface) p-4 text-sm text-(--text-secondary)">
          Carregando memorias...
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-xl border border-(--border) bg-(--bg-surface) p-4 text-sm text-(--text-secondary)">
          Nenhuma memoria registrada ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => (
            <article key={memory.id} className="rounded-xl border border-(--border) bg-(--bg-surface) p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-(--text-secondary)">
                  {memory.priority} - {memory.type}
                </p>
                <select
                  value={memory.priority}
                  onChange={(event) =>
                    void patchMemory(memory.id, { priority: event.target.value as MemoryPriority })
                  }
                  disabled={updatingId === memory.id}
                  className="rounded-md border border-(--border) bg-white px-2 py-1 text-xs text-(--text-primary)"
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              <p className="mt-2 text-sm text-(--text-primary)">{memory.content}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void patchMemory(memory.id, { priority: "P0", type: "fixed" })}
                  disabled={updatingId === memory.id}
                  className="rounded-md border border-(--border) bg-white/70 px-2 py-1 text-[11px] font-medium text-(--text-primary) disabled:opacity-50"
                >
                  Fixar (P0)
                </button>
                <button
                  type="button"
                  onClick={() => void sendFeedback(memory.id, "useful")}
                  disabled={updatingId === memory.id}
                  className="rounded-md border border-(--border) bg-white/70 px-2 py-1 text-[11px] font-medium text-(--text-primary) disabled:opacity-50"
                >
                  Util
                </button>
                <button
                  type="button"
                  onClick={() => void sendFeedback(memory.id, "not_useful")}
                  disabled={updatingId === memory.id}
                  className="rounded-md border border-(--border) bg-white/70 px-2 py-1 text-[11px] font-medium text-(--text-primary) disabled:opacity-50"
                >
                  Nao util
                </button>
                <button
                  type="button"
                  onClick={() => void patchMemory(memory.id, { priority: "P4", type: "obsolete" })}
                  disabled={updatingId === memory.id}
                  className="rounded-md border border-(--border) bg-white/70 px-2 py-1 text-[11px] font-medium text-(--text-primary) disabled:opacity-50"
                >
                  Marcar obsoleta
                </button>
                <button
                  type="button"
                  onClick={() => void handleEdit(memory)}
                  disabled={updatingId === memory.id}
                  className="rounded-md border border-(--border) bg-white/70 px-2 py-1 text-[11px] font-medium text-(--text-primary) disabled:opacity-50"
                >
                  Editar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
