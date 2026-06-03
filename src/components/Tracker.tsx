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
    if (t) window.setTimeout(() => setToast(null), 2200);
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
      if (macro.subs.length === 0) {
        book(pieceType, macro.id, null, macro.name);
      } else {
        setSelectedMacroId(macro.id);
        setStep("sub");
      }
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
        return;
      }

      if (step === "macro") {
        const idx = macroKeys.lookup.get(key);
        if (idx !== undefined && macros[idx]) { e.preventDefault(); selectMacro(macros[idx]); }
        return;
      }

      if (step === "sub") {
        const idx = subKeys.lookup.get(key);
        if (idx !== undefined) { e.preventDefault(); selectSub(idx); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, macros, macroKeys, subKeys, selectPiece, selectMacro, selectSub, undo]);

  if (macros.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold">Noch keine Kategorien</h1>
        <p className="mt-2 text-muted">
          Lege zuerst deine DNF-Gründe an, dann kannst du sie hier per Klick oder Tastatur erfassen.
        </p>
        <Link href="/settings" className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-white hover:opacity-90">
          Kategorien anlegen →
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {step === "piece" && "DNF erfassen"}
            {step === "macro" && <>{PieceBadge(pieceType!)} Grund wählen</>}
            {step === "sub" && <>{PieceBadge(pieceType!)} {selectedMacro?.name}</>}
          </h1>
          <p className="text-sm text-muted">
            {step === "piece" && "Wo ist der Fehler passiert?"}
            {step === "macro" && "Welche Art von Fehler?"}
            {step === "sub" && "Unterkategorie wählen."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {step !== "piece" && (
            <><kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5">Esc</kbd><span>zurück</span></>
          )}
          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5">U</kbd>
          <span>rückgängig</span>
        </div>
      </div>

      {/* Breadcrumb */}
      {step !== "piece" && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted">
          <button onClick={reset} className="hover:text-white">Start</button>
          <span>/</span>
          <span className={step === "macro" ? "text-white" : "hover:text-white cursor-pointer"}
            onClick={() => step === "sub" && (() => { setStep("macro"); setSelectedMacroId(null); })()}>
            {PIECE_LABELS[pieceType!]}
          </span>
          {step === "sub" && (
            <><span>/</span><span className="text-white">{selectedMacro?.name}</span></>
          )}
        </div>
      )}

      {/* Step: Piece type */}
      {step === "piece" && (
        <div className="grid grid-cols-2 gap-4">
          <PieceTile piece="edges" shortcut="E" onClick={() => selectPiece("edges")} disabled={isPending} />
          <PieceTile piece="corners" shortcut="C" onClick={() => selectPiece("corners")} disabled={isPending} />
        </div>
      )}

      {/* Step: Macro */}
      {step === "macro" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {macros.map((m, i) => (
            <Tile
              key={m.id}
              shortcut={macroKeys.effective[i]}
              title={m.name}
              subtitle={m.subs.length > 0 ? `${m.subs.length} Unterkat.` : "direkt"}
              onClick={() => selectMacro(m)}
              disabled={isPending}
              color="accent"
            />
          ))}
        </div>
      )}

      {/* Step: Sub */}
      {step === "sub" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {selectedMacro!.subs.map((s, i) => (
            <Tile
              key={s.id}
              shortcut={subKeys.effective[i]}
              title={s.name}
              onClick={() => selectSub(i)}
              disabled={isPending}
              color="accent-2"
            />
          ))}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
          toast.kind === "ok" ? "bg-accent-2 text-black" : "bg-danger text-white"
        }`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function PieceBadge(piece: PieceType) {
  return (
    <span className={`mr-2 rounded px-2 py-0.5 text-sm font-semibold ${
      piece === "edges" ? "bg-accent/20 text-accent" : "bg-accent-2/20 text-accent-2"
    }`}>
      {PIECE_LABELS[piece]}
    </span>
  );
}

function PieceTile({ piece, shortcut, onClick, disabled }: {
  piece: PieceType; shortcut: string; onClick: () => void; disabled?: boolean;
}) {
  const isEdges = piece === "edges";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-2xl border-2 transition-all disabled:opacity-60 ${
        isEdges
          ? "border-accent/40 bg-accent/5 hover:border-accent hover:bg-accent/10"
          : "border-accent-2/40 bg-accent-2/5 hover:border-accent-2 hover:bg-accent-2/10"
      }`}
    >
      <kbd className={`absolute right-3 top-3 rounded border px-1.5 py-0.5 text-xs ${
        isEdges ? "border-accent/40 bg-accent/10 text-accent" : "border-accent-2/40 bg-accent-2/10 text-accent-2"
      }`}>
        {shortcut}
      </kbd>
      <span className={`text-4xl font-bold ${isEdges ? "text-accent" : "text-accent-2"}`}>
        {isEdges ? "E" : "C"}
      </span>
      <span className="text-lg font-semibold">{PIECE_LABELS[piece]}</span>
    </button>
  );
}

function Tile({ shortcut, title, subtitle, onClick, disabled, color }: {
  shortcut: string | null; title: string; subtitle?: string;
  onClick: () => void; disabled?: boolean; color: "accent" | "accent-2";
}) {
  const ac = color === "accent";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex min-h-[88px] flex-col justify-between rounded-xl border p-4 text-left transition-all disabled:opacity-60 ${
        ac ? "border-border bg-surface hover:border-accent hover:bg-surface-2"
           : "border-border bg-surface hover:border-accent-2 hover:bg-surface-2"
      }`}
    >
      {shortcut && (
        <kbd className={`absolute right-2 top-2 rounded border px-1.5 py-0.5 text-xs ${
          ac ? "border-accent/40 bg-accent/10 text-accent" : "border-accent-2/40 bg-accent-2/10 text-accent-2"
        }`}>
          {shortcut.toUpperCase()}
        </kbd>
      )}
      <span className="pr-8 font-medium leading-tight">{title}</span>
      {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
    </button>
  );
}
