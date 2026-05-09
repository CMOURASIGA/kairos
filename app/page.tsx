const DASHBOARD_ITEMS = [
  {
    title: "Foco Atual",
    value: "Kairos Core + Chat + Memoria Basica",
    detail: "Prioridade de entrega definida nos documentos",
  },
  {
    title: "Especialista Principal",
    value: "Kairos PM",
    detail: "Caso de uso ancora inicial",
  },
  {
    title: "Rotina",
    value: "Daily Inicial",
    detail: "Resumo operacional e perguntas inteligentes",
  },
];

export default function HomePage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-(--text-primary)">Dashboard</h2>
      <p className="text-sm text-(--text-secondary)">
        Visao operacional do MVP do Kairos com foco em continuidade contextual.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {DASHBOARD_ITEMS.map((item) => (
          <article key={item.title} className="rounded-xl border border-(--border) bg-(--bg-surface) p-4">
            <p className="text-xs uppercase tracking-wide text-(--text-secondary)">{item.title}</p>
            <p className="mt-2 text-base font-semibold text-(--text-primary)">{item.value}</p>
            <p className="mt-2 text-sm text-(--text-secondary)">{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
