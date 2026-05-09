import { getDailySnapshot } from "@/services/daily-service";
import { getDefaultUserId } from "@/lib/user-context";

function DailySection({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-xl border border-(--border) bg-(--bg-surface) p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-(--text-primary)">
        {items.map((item) => (
          <li key={item} className="rounded-lg bg-(--bg-muted) px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

export default async function DailyPage() {
  const daily = await getDailySnapshot(getDefaultUserId());

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-(--text-primary)">Kairos Daily</h2>
      <p className="text-sm text-(--text-secondary)">
        Resumo operacional diario com prioridades, pendencias, agenda, riscos e perguntas de continuidade.
      </p>

      <article className="rounded-xl border border-(--border) bg-(--bg-surface) p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Resumo do Dia</h3>
        <p className="mt-3 text-sm text-(--text-primary)">{daily.summary}</p>
      </article>

      <div className="grid gap-4 lg:grid-cols-2">
        <DailySection title="Prioridades" items={daily.priorities} />
        <DailySection title="Pendencias" items={daily.pendings} />
        <DailySection title="Agenda" items={daily.agenda} />
        <DailySection title="Riscos" items={daily.risks} />
        <DailySection title="Sugestoes" items={daily.suggestions} />
        <DailySection title="Perguntas Inteligentes" items={daily.smartQuestions} />
      </div>
    </section>
  );
}
