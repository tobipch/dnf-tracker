"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Tracker" },
  { href: "/stats", label: "Statistiken" },
  { href: "/settings", label: "Einstellungen" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border/60 bg-bg/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-3 py-2.5 sm:px-4 sm:py-3">
        <span className="mr-3 flex shrink-0 items-baseline gap-1.5 sm:mr-6">
          <span className="text-gradient text-lg font-black tracking-tight sm:text-xl">3BLD</span>
          {/* Auf dem Handy zählt jeder Pixel – der Untertitel entfällt dort. */}
          <span className="hidden text-xs font-medium tracking-widest text-muted uppercase sm:inline">
            Tracker
          </span>
        </span>

        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`relative shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold tracking-wide transition-all duration-200 sm:px-3.5 ${
                active ? "text-accent" : "text-muted hover:text-white"
              }`}
            >
              {active && (
                <span
                  className="absolute inset-0 rounded-lg border border-accent/40 bg-accent/8"
                  style={{ boxShadow: "0 0 12px rgba(0,212,255,0.2), inset 0 0 12px rgba(0,212,255,0.04)" }}
                />
              )}
              <span className="relative">{l.label}</span>
            </Link>
          );
        })}

        {/* Right-side accent line */}
        <div className="ml-auto hidden h-px w-16 bg-gradient-to-r from-accent/40 to-transparent sm:block" />
      </nav>

      {/* Neon bottom border */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
    </header>
  );
}
