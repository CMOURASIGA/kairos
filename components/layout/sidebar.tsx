"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/chat", label: "Chat" },
  { href: "/daily", label: "Daily" },
  { href: "/projects", label: "Projetos" },
  { href: "/memory", label: "Memoria" },
  { href: "/settings", label: "Configuracoes" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-(--border) bg-(--bg-surface) px-4 py-4 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent) text-sm font-bold text-white">
          K
        </div>
        <div>
          <p className="text-sm font-semibold text-(--text-primary)">Kairos</p>
          <p className="text-xs text-(--text-secondary)">Cognitive Ops</p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 md:flex-col">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-(--accent) text-white"
                  : "bg-(--bg-muted) text-(--text-secondary) hover:bg-(--accent-soft)",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
