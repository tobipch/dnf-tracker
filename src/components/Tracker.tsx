"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { MacroWithSubs } from "@/db/queries";
import { recordDnf, undoLastDnf } from "@/app/actions";

type PieceType = "edges" | "corners";
type Step = "piece" | "macro" | "sub";
type Toast = { kind: "ok" | "err"; text: string } | null;

function fallbackKey(index: number): string | null {
  if (index < 9) return String(index + 1);
  if (index === 9) return "0";
  return null;
}

function buildKeyMap<T extends { shortcut: string | null }>(items: T[]) {
  const used = new Set<string>();
  items.forEach((it) => { if (it.shortcut) used.add(it.shortcut.toLowerCase()); });
  const effective: (string | null)[] = items.map((it, i) => {
    const explicit = it.shortcut?.toLowerCase() ?? null;
    if (explicit) return explicit;
    const fb = fallbackKey(i);
    if (fb && !used.has(fb)) { used.add(fb); return fb; }
    return null;
  });
  const lookup = new Map<string, number>();
  effective.forEach((k, i) => { if (k && !lookup.has(k)) lookup.set(k, i); });
  return { effective, lookup };
}

const PIECE_LABELS: Record<PieceType, string> = { edges: "Edges", corners: "Corners" };
const PIECE_KEYS: Record<string, PieceType> = { e: "edges", c: "corners" };

export default function Tracker({ macros }: { macros: MacroWithSubs[] }) {
  const [step, setStep] = useState<Step>("piece");
  const [pieceType, setPieceType] = useState<PieceType | null>(null);
  const [selectedMacroId, setSelectedMacroId] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [isPending, startTransition] = useTransition();

  const selectedMacro = useMemo(
    () => macros.find((m) => m.id === selectedMacroId) ?? null,
    [macros, selectedMacroId]
  );

  const macroKeys = useMemo(() => buildKeyMap(macros), [macros]);
  const subKeys = useMemo(() => buildKeyMap(selectedMacro?.subs ?? []), [selectedMacro]);

  const flash = useCallback((t: Toast) => {
    setToast(t);
    if (t) window.setTimeout(() => setToast(null), 2400);
  }, []);

  const reset = useCallback(() => {
    setStep("piece");
    setPieceType(null);
    setSelectedMacroId(null);
  }, []);

  const book = useCallback(
    (pt: PieceType, macroId: number, subId: number | null, label: string) => {
      startTransition(async () => {
        const res = await recordDnf(pt, macroId, subId);
        if (res.ok) {
          flash({ kind: "ok", text: `${PIECE_LABELS[pt]}: ${label}` });
          reset();
        } else {
          flash({ kind: "err", text: res.error });
        }
      });
    },
    [flash, reset]
  );

  const selectPiece = useCallback((pt: PieceType) => {
    setPieceType(pt);
    setStep("macro");
  }, []);

  const selectMacro = useCallback(
    (macro: MacroWithSubs) => {
      if (!pieceType) return;
      if (macro.subs.length === 0) book(pieceType, macro.id, null, macro.name);
      else { setSelectedMacroId(macro.id); setStep("sub"); }
    },
    [pieceType, book]
  );

  const selectSub = useCallback(
    (subIndex: number) => {
      if (!selectedMacro || !pieceType) return;
      const sub = selectedMacro.subs[subIndex];
      if (!sub) return;
      book(pieceType, selectedMacro.id, sub.id, `${selectedMacro.name} → ${sub.name}`);
    },
    [selectedMacro, pieceType, book]
  );

  const undo = useCallback(() => {
    startTransition(async () => {
      const res = await undoLastDnf();
      flash(res.ok ? { kind: "ok", text: res.message ?? "Rückgängig." } : { kind: "err", text: res.error });
    });
  }, [flash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "escape") {
        e.preventDefault();
        if (step === "sub") { setStep("macro"); setSelectedMacroId(null); }
        else if (step === "macro") { setStep("piece"); setPieceType(null); }
        return;
      }
      if (key === "u") { e.preventDefault(); undo(); return; }
      if (step === "piece") {
        const pt = PIECE_KEYS[key];
        if (pt) { e.preventDefault(); selectPiece(pt); }
      } else if (step === "macro") {
        const idx = macroKeys.lookup.get(key);
        if (idx !== undefined && macros[idx]) { e.preventDefault(); selectMacro(macros[idx]); }
      } else if (step === "sub") {
        const idx = subKeys.lookup.get(key);
        if (idx !== undefined) { e.preventDefault(); selectSub(idx); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, macros, macroKeys, subKeys, selectPiece, selectMacro, selectSub, undo]);

  if (macros.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-surface/60 p-10 text-center backdrop-blur">
        <div className="text-gradient mb-3 text-5xl font-black">DNF?</div>
        <h1 className="text-xl font-bold">Noch keine Kategorien</h1>
        <p className="mt-2 text-muted">
          Lege deine Fehlergründe an — dann kannst du sie hier blitzschnell erfassen.
        </p>
        <Link
          href="/settings"
          className="mt-6 inline-block rounded-xl border border-accent/40 bg-accent/10 px-6 py-2.5 font-semibold text-accent transition-all hover:bg-accent/20"
          style={{ boxShadow: "0 0 16px rgba(0,212,255,0.2)" }}
        >
          Kategorien anlegen →
        </Link>
      </div>
    );
  }

  return (
    <div className="relative animate-fade-in">

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {(["piece", "macro", "sub"] as Step[]).map((s, i) => {
          const done = ["piece","macro","sub"].indexOf(step) > i;
          const active = step === s;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-1.5 rounded-full transition-all duration-300 ${
                active ? "w-8 bg-accent shadow-neon-blue-sm" :
                done   ? "w-3 bg-accent/40" :
                          "w-3 bg-border"
              }`} />
            </div>
          );
        })}
        <div className="ml-2 flex items-center gap-2 text-xs text-muted">
          {step !== "piece" && (
            <><kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5">Esc</kbd><span>zurück</span></>
          )}
          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5">U</kbd>
          <span>undo</span>
        </div>
      </div>

      {/* Headline */}
      <div className="mb-6">
        {step === "piece" && (
          <>
            <h1 className="text-3xl font-black tracking-tight">
              DNF <span className="text-gradient">erfassen</span>
            </h1>
            <p className="mt-1 text-sm text-muted">Wo ist der Fehler passiert?</p>
          </>
        )}
        {step === "macro" && (
          <>
            <div className="mb-1 flex items-center gap-2">
              <PiecePill piece={pieceType!} />
              <span className="text-muted">→</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Welcher Fehler?</h1>
          </>
        )}
        {step === "sub" && (
          <>
            <div className="mb-1 flex items-center gap-2">
              <PiecePill piece={pieceType!} />
              <span className="text-muted">→</span>
              <span className="font-semibold text-white">{selectedMacro?.name}</span>
              <span className="text-muted">→</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Genauer?</h1>
          </>
        )}
      </div>

      {/* STEP 1: Piece type */}
      {step === "piece" && (
        <div className="grid grid-cols-2 gap-5 animate-slide-up">
          <PieceTile piece="edges" shortcut="E" onClick={() => selectPiece("edges")} disabled={isPending} />
          <PieceTile piece="corners" shortcut="C" onClick={() => selectPiece("corners")} disabled={isPending} />
        </div>
      )}

      {/* STEP 2: Macro */}
      {step === "macro" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 animate-slide-up">
          {macros.map((m, i) => (
            <CategoryTile
              key={m.id}
              shortcut={macroKeys.effective[i]}
              title={m.name}
              subtitle={m.subs.length > 0 ? `${m.subs.length} Unterkat.` : undefined}
              onClick={() => selectMacro(m)}
              disabled={isPending}
              piece={pieceType!}
            />
          ))}
        </div>
      )}

      {/* STEP 3: Sub */}
      {step === "sub" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 animate-slide-up">
          {selectedMacro!.subs.map((s, i) => (
            <CategoryTile
              key={s.id}
              shortcut={subKeys.effective[i]}
              title={s.name}
              onClick={() => selectSub(i)}
              disabled={isPending}
              piece={pieceType!}
            />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 animate-slide-up rounded-xl px-5 py-3 text-sm font-bold tracking-wide ${
          toast.kind === "ok"
            ? "border border-accent-2/40 bg-accent-2/15 text-accent-2"
            : "border border-danger/40 bg-danger/15 text-danger"
        }`}
          style={{ boxShadow: toast.kind === "ok" ? "0 0 20px rgba(0,255,148,0.2)" : "0 0 20px rgba(255,45,120,0.2)" }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function PiecePill({ piece }: { piece: PieceType }) {
  const isEdges = piece === "edges";
  return (
    <span className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold tracking-widest uppercase ${
      isEdges
        ? "border-accent/40 bg-accent/10 text-accent"
        : "border-accent-2/40 bg-accent-2/10 text-accent-2"
    }`}>
      {PIECE_LABELS[piece]}
    </span>
  );
}

function PieceTile({ piece, shortcut, onClick, disabled }: {
  piece: PieceType; shortcut: string; onClick: () => void; disabled?: boolean;
}) {
  const isEdges = piece === "edges";
  const clrHex = isEdges ? "#00d4ff" : "#00ff94";
  const borderIdle = isEdges ? "border-accent/25" : "border-accent-2/25";
  const borderHover = isEdges ? "hover:border-accent" : "hover:border-accent-2";
  const bgIdle = isEdges ? "bg-accent/[0.04]" : "bg-accent-2/[0.04]";
  const bgHover = isEdges ? "hover:bg-accent/[0.09]" : "hover:bg-accent-2/[0.09]";
  const shadowHover = isEdges ? "hover:shadow-neon-blue" : "hover:shadow-neon-green";
  const animGlow = isEdges ? "animate-glow-blue" : "animate-glow-green";
  const textClass = isEdges ? "text-gradient" : "text-gradient-green";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex min-h-[200px] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 transition-all duration-300 disabled:opacity-50 ${borderIdle} ${borderHover} ${bgIdle} ${bgHover} ${shadowHover} ${animGlow}`}
    >
      {/* Watermark letter */}
      <span
        className="pointer-events-none absolute select-none text-[11rem] font-black leading-none opacity-[0.05] transition-opacity duration-300 group-hover:opacity-[0.09]"
        style={{ color: clrHex }}
      >
        {isEdges ? "E" : "C"}
      </span>

      {/* Shortcut badge */}
      <kbd className={`absolute right-3 top-3 rounded-lg border px-2 py-0.5 text-xs font-mono font-bold ${
        isEdges ? "border-accent/35 bg-accent/10 text-accent" : "border-accent-2/35 bg-accent-2/10 text-accent-2"
      }`}>
        {shortcut}
      </kbd>

      {/* Label */}
      <span className={`relative text-5xl font-black tracking-tight ${textClass}`}>
        {isEdges ? "E" : "C"}
      </span>
      <span className={`relative text-sm font-bold tracking-[0.25em] uppercase ${
        isEdges ? "text-accent" : "text-accent-2"
      }`}>
        {PIECE_LABELS[piece]}
      </span>
    </button>
  );
}

function CategoryTile({ shortcut, title, subtitle, onClick, disabled, piece }: {
  shortcut: string | null; title: string; subtitle?: string;
  onClick: () => void; disabled?: boolean; piece: PieceType;
}) {
  const isEdges = piece === "edges";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex min-h-[90px] flex-col justify-between rounded-xl border bg-surface p-4 text-left transition-all duration-200 disabled:opacity-60 ${
        isEdges
          ? "border-border hover:border-accent/70 hover:bg-accent/5 hover:shadow-neon-blue-sm"
          : "border-border hover:border-accent-2/70 hover:bg-accent-2/5 hover:shadow-neon-green-sm"
      }`}
    >
      {shortcut && (
        <kbd className={`absolute right-2 top-2 rounded-md border px-1.5 py-0.5 text-xs font-mono font-bold ${
          isEdges
            ? "border-accent/30 bg-accent/8 text-accent"
            : "border-accent-2/30 bg-accent-2/8 text-accent-2"
        }`}>
          {shortcut.toUpperCase()}
        </kbd>
      )}
      <span className="pr-8 text-sm font-semibold leading-tight text-white/90 group-hover:text-white">
        {title}
      </span>
      {subtitle && (
        <span className="mt-1 text-xs text-muted">{subtitle}</span>
      )}
    </button>
  );
}
