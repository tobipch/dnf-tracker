"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { MacroWithSubs } from "@/db/queries";
import { recordDnf, undoLastDnf } from "@/app/actions";

type Toast = { kind: "ok" | "err"; text: string } | null;

/** Fallback shortcut for the nth item (0-indexed) when none is configured. */
function fallbackKey(index: number): string | null {
  if (index < 9) return String(index + 1); // 1..9
  if (index === 9) return "0";
  return null;
}

/** Builds index -> effective shortcut, and a lookup key -> index. */
function buildKeyMap<T extends { shortcut: string | null }>(items: T[]) {
  const effective: (string | null)[] = [];
  const used = new Set<string>();
  // First pass: explicit shortcuts win.
  items.forEach((it) => {
    const s = it.shortcut?.toLowerCase() ?? null;
    if (s && !used.has(s)) used.add(s);
  });
  // Second pass: assign effective key per item (explicit, else first free fallback).
  items.forEach((it, i) => {
    const explicit = it.shortcut?.toLowerCase() ?? null;
    if (explicit) {
      effective[i] = explicit;
      return;
    }
    const fb = fallbackKey(i);
    if (fb && !used.has(fb)) {
      used.add(fb);
      effective[i] = fb;
    } else {
      effective[i] = null;
    }
  });
  const lookup = new Map<string, number>();
  effective.forEach((k, i) => {
    if (k && !lookup.has(k)) lookup.set(k, i);
  });
  return { effective, lookup };
}

export default function Tracker({ macros }: { macros: MacroWithSubs[] }) {
  const [selectedMacroId, setSelectedMacroId] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [isPending, startTransition] = useTransition();

  const selectedMacro = useMemo(
    () => macros.find((m) => m.id === selectedMacroId) ?? null,
    [macros, selectedMacroId]
  );

  const macroKeys = useMemo(() => buildKeyMap(macros), [macros]);
  const subKeys = useMemo(
    () => buildKeyMap(selectedMacro?.subs ?? []),
    [selectedMacro]
  );

  const flash = useCallback((t: Toast) => {
    setToast(t);
    if (t) window.setTimeout(() => setToast(null), 2200);
  }, []);

  const book = useCallback(
    (macroId: number, subId: number | null, label: string) => {
      startTransition(async () => {
        const res = await recordDnf(macroId, subId);
        if (res.ok) {
          flash({ kind: "ok", text: `DNF gespeichert: ${label}` });
          setSelectedMacroId(null);
        } else {
          flash({ kind: "err", text: res.error });
        }
      });
    },
    [flash]
  );

  const selectMacro = useCallback(
    (macro: MacroWithSubs) => {
      if (macro.subs.length === 0) {
        // No sub categories -> book immediately at macro level.
        book(macro.id, null, macro.name);
      } else {
        setSelectedMacroId(macro.id);
      }
    },
    [book]
  );

  const selectSub = useCallback(
    (subIndex: number) => {
      if (!selectedMacro) return;
      const sub = selectedMacro.subs[subIndex];
      if (!sub) return;
      book(selectedMacro.id, sub.id, `${selectedMacro.name} → ${sub.name}`);
    },
    [selectedMacro, book]
  );

  const undo = useCallback(() => {
    startTransition(async () => {
      const res = await undoLastDnf();
      flash(res.ok ? { kind: "ok", text: res.message ?? "Rückgängig." } : { kind: "err", text: res.error });
    });
  }, [flash]);

  // Keyboard handling
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === "escape") {
        if (selectedMacroId !== null) {
          e.preventDefault();
          setSelectedMacroId(null);
        }
        return;
      }

      if (key === "u") {
        e.preventDefault();
        undo();
        return;
      }

      if (selectedMacroId === null) {
        const idx = macroKeys.lookup.get(key);
        if (idx !== undefined && macros[idx]) {
          e.preventDefault();
          selectMacro(macros[idx]);
        }
      } else {
        const idx = subKeys.lookup.get(key);
        if (idx !== undefined) {
          e.preventDefault();
          selectSub(idx);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [macros, macroKeys, subKeys, selectedMacroId, selectMacro, selectSub, undo]);

  if (macros.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold">Noch keine Kategorien</h1>
        <p className="mt-2 text-muted">
          Lege zuerst deine DNF-Gründe an, dann kannst du sie hier per Klick oder Tastatur erfassen.
        </p>
        <Link
          href="/settings"
          className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-white hover:opacity-90"
        >
          Kategorien anlegen →
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {selectedMacro ? selectedMacro.name : "DNF erfassen"}
          </h1>
          <p className="text-sm text-muted">
            {selectedMacro
              ? "Wähle eine Unterkategorie (Klick oder Taste)."
              : "Wähle den Grund per Klick oder Tastatur."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5">U</kbd>
          <span>rückgängig</span>
          {selectedMacro && (
            <>
              <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5">Esc</kbd>
              <span>zurück</span>
            </>
          )}
        </div>
      </div>

      {!selectedMacro ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {macros.map((m, i) => (
            <Tile
              key={m.id}
              shortcut={macroKeys.effective[i]}
              title={m.name}
              subtitle={m.subs.length > 0 ? `${m.subs.length} Unterkat.` : "direkt"}
              onClick={() => selectMacro(m)}
              disabled={isPending}
            />
          ))}
        </div>
      ) : (
        <>
          <button
            onClick={() => setSelectedMacroId(null)}
            className="mb-3 text-sm text-muted hover:text-white"
          >
            ← zurück zu allen Gründen
          </button>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {selectedMacro.subs.map((s, i) => (
              <Tile
                key={s.id}
                shortcut={subKeys.effective[i]}
                title={s.name}
                onClick={() => selectSub(i)}
                disabled={isPending}
                variant="sub"
              />
            ))}
          </div>
        </>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
            toast.kind === "ok" ? "bg-accent-2 text-black" : "bg-danger text-white"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function Tile({
  shortcut,
  title,
  subtitle,
  onClick,
  disabled,
  variant = "macro",
}: {
  shortcut: string | null;
  title: string;
  subtitle?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "macro" | "sub";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex min-h-[88px] flex-col justify-between rounded-xl border p-4 text-left transition-all disabled:opacity-60 ${
        variant === "macro"
          ? "border-border bg-surface hover:border-accent hover:bg-surface-2"
          : "border-border bg-surface hover:border-accent-2 hover:bg-surface-2"
      }`}
    >
      {shortcut && (
        <kbd
          className={`absolute right-2 top-2 rounded border px-1.5 py-0.5 text-xs ${
            variant === "macro"
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-accent-2/40 bg-accent-2/10 text-accent-2"
          }`}
        >
          {shortcut.toUpperCase()}
        </kbd>
      )}
      <span className="pr-8 font-medium leading-tight">{title}</span>
      {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
    </button>
  );
}
