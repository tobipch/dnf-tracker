"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const links = [
  { href: "/", label: "Tracker" },
  { href: "/stats", label: "Statistiken" },
  { href: "/settings", label: "Einstellungen" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Beim Seitenwechsel schliessen – sonst bleibt das Menü über der neuen Seite offen.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = links.find((l) => l.href === pathname);

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-border/60 bg-bg/90 backdrop-blur-xl">
      <nav ref={menuRef} className="safe-x mx-auto max-w-5xl">
        <div className="flex h-14 items-center justify-between gap-2">
          <Link href="/" className="flex shrink-0 items-baseline gap-1.5">
            <span className="text-gradient text-lg font-black tracking-tight sm:text-xl">3BLD</span>
            <span className="hidden text-xs font-medium uppercase tracking-widest text-muted sm:inline">
              DNF Tracker
            </span>
          </Link>

          {/* Ab sm ist Platz für die volle Navigation. */}
          <div className="hidden items-center gap-1 sm:flex">
            {links.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} active={pathname === l.href} />
            ))}
          </div>

          {/* Auf dem Handy nur der aktuelle Seitenname plus Menütrigger. */}
          <div className="flex items-center gap-2 sm:hidden">
            <span className="text-sm font-semibold text-muted">{current?.label}</span>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="Menü"
              aria-expanded={open}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                open ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-white/80"
              }`}
            >
              <span className="flex w-5 flex-col gap-[5px]">
                <span
                  className={`h-[2px] w-full rounded bg-current transition-transform ${
                    open ? "translate-y-[7px] rotate-45" : ""
                  }`}
                />
                <span className={`h-[2px] w-full rounded bg-current transition-opacity ${open ? "opacity-0" : ""}`} />
                <span
                  className={`h-[2px] w-full rounded bg-current transition-transform ${
                    open ? "-translate-y-[7px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {open && (
          <div className="pb-3 sm:hidden animate-slide-up">
            <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-1.5">
              {links.map((l) => {
                const active = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`flex h-12 items-center rounded-xl px-3 text-base font-semibold transition ${
                      active ? "bg-accent/10 text-accent" : "text-white/85 active:bg-surface-2"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative rounded-lg px-3.5 py-1.5 text-sm font-semibold tracking-wide transition-all duration-200 ${
        active ? "text-accent" : "text-muted hover:text-white"
      }`}
    >
      {active && (
        <span
          className="absolute inset-0 rounded-lg border border-accent/40 bg-accent/8"
          style={{ boxShadow: "0 0 12px rgba(0,212,255,0.2), inset 0 0 12px rgba(0,212,255,0.04)" }}
        />
      )}
      <span className="relative">{label}</span>
    </Link>
  );
}
