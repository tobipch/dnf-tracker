"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Tracker" },
  { href: "/stats", label: "Statistiken" },
  { href: "/settings", label: "Kategorien" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-surface/60 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
        <span className="mr-4 font-semibold tracking-tight">
          🧩 <span className="text-accent">DNF</span> Tracker
        </span>
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                active ? "bg-accent text-white" : "text-muted hover:bg-surface-2 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
