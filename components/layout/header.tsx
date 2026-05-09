export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-(--border) bg-(--bg-surface) px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold text-(--text-primary)">Kairos Workspace</h1>
        <p className="text-sm text-(--text-secondary)">
          Memoria compartilhada e operacao contextual continua
        </p>
      </div>
      <span className="rounded-full bg-(--accent-soft) px-3 py-1 text-xs font-medium text-(--accent)">
        Core Online
      </span>
    </header>
  );
}
