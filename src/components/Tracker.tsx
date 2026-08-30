"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Reason, PieceType, Phase } from "@/db/schema";
import type { TrackerData } from "@/db/queries";
import { recordAttempt, undoLastAttempt, createReason } from "@/app/actions";

type Draft = {
  key: string;
  pieceType: PieceType;
  phase: Phase;
  reasonId: number | null;
  reasonName: string;
  comment: string;
};

type Toast = { kind: "ok" | "err"; text: string } | null;

const PIECE_LABEL: Record<PieceType, string> = { edges: "Edges", corners: "Corners" };
const PHASE_LABEL: Record<Phase, string> = { memo: "Memo", exec: "Execution" };

/** Tasten, die die Oberfläche selbst belegt und die kein Grund überschreiben darf. */
const RESERVED_KEYS = new Set([
  "1",
  "2",
  "e",
  "c",
  "enter",
  "escape",
  " ",
  "tab",
  "backspace",
  "/",
]);

const PIECE_STYLE: Record<
  PieceType,
  { text: string; border: string; bg: string; ring: string; dot: string }
> = {
  edges: {
    text: "text-accent",
    border: "border-accent/50",
    bg: "bg-accent/10",
    ring: "shadow-neon-blue-sm",
    dot: "bg-accent",
  },
  corners: {
    text: "text-purple",
    border: "border-purple/50",
    bg: "bg-purple/10",
    ring: "shadow-neon-purple",
    dot: "bg-purple",
  },
};

let draftSeq = 0;
function nextKey() {
  draftSeq += 1;
  return `d${draftSeq}`;
}

export default function Tracker({ data }: { data: TrackerData }) {
  const [mode, setMode] = useState<"idle" | "dnf">("idle");
  const [activePiece, setActivePiece] = useState<PieceType>("edges");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState<Phase | null>(null);
  const [addName, setAddName] = useState("");
  const [addKey, setAddKey] = useState("");

  // Optimistische Zähler, damit die Zahlen sofort reagieren.
  const [pendingSuccess, setPendingSuccess] = useState(0);
  const [pendingDnf, setPendingDnf] = useState(0);
  useEffect(() => {
    setPendingSuccess(0);
    setPendingDnf(0);
  }, [data]);

  const commentRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const addNameRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);

  const allReasons = useMemo(
    () => [...data.reasons.memo, ...data.reasons.exec],
    [data.reasons]
  );

  /** Shortcut → Grund. Reservierte Tasten gewinnen immer gegen einen Grund. */
  const shortcutMap = useMemo(() => {
    const map = new Map<string, Reason>();
    for (const r of allReasons) {
      const k = r.shortcut?.toLowerCase();
      if (!k || RESERVED_KEYS.has(k) || map.has(k)) continue;
      map.set(k, r);
    }
    return map;
  }, [allReasons]);

  const flash = useCallback((t: Toast) => {
    setToast(t);
    if (t) window.setTimeout(() => setToast(null), 2000);
  }, []);

  const resetPanel = useCallback(() => {
    setDrafts([]);
    setNote("");
    setAddOpen(null);
    setAddName("");
    setAddKey("");
    setActivePiece("edges");
    setMode("idle");
  }, []);

  /** Ein DNF startet immer bei den Edges. */
  const openDnf = useCallback(() => {
    setActivePiece("edges");
    setMode("dnf");
  }, []);

  /* ------------------------------ Speichern ------------------------------ */

  const saveSuccess = useCallback(() => {
    setPendingSuccess((n) => n + 1);
    startTransition(async () => {
      const res = await recordAttempt({ isDnf: false });
      if (!res.ok) {
        setPendingSuccess((n) => Math.max(0, n - 1));
        flash({ kind: "err", text: res.error });
      } else {
        flash({ kind: "ok", text: "Success ✓" });
      }
    });
  }, [flash]);

  const saveDnf = useCallback(
    (list: Draft[], attemptNote: string) => {
      setPendingDnf((n) => n + 1);
      resetPanel();
      startTransition(async () => {
        const res = await recordAttempt({
          isDnf: true,
          note: attemptNote,
          errors: list.map((d) => ({
            pieceType: d.pieceType,
            phase: d.phase,
            reasonId: d.reasonId,
            comment: d.comment,
          })),
        });
        if (!res.ok) {
          setPendingDnf((n) => Math.max(0, n - 1));
          flash({ kind: "err", text: res.error });
        } else {
          flash({
            kind: "ok",
            text: list.length > 0 ? `DNF · ${list.length} Fehler erfasst` : "DNF ohne Grund erfasst",
          });
        }
      });
    },
    [flash, resetPanel]
  );

  const undo = useCallback(() => {
    startTransition(async () => {
      const res = await undoLastAttempt();
      flash(res.ok ? { kind: "ok", text: res.message ?? "Rückgängig." } : { kind: "err", text: res.error });
    });
  }, [flash]);

  /* -------------------------- Fehler-Bausteine --------------------------- */

  const addDraft = useCallback((reason: Reason, piece: PieceType) => {
    setDrafts((prev) => [
      ...prev,
      {
        key: nextKey(),
        pieceType: piece,
        phase: reason.phase as Phase,
        reasonId: reason.id,
        reasonName: reason.name,
        comment: "",
      },
    ]);
    // Nach jedem erfassten Fehler direkt zu den Corners – der übliche Ablauf ist
    // Edges zuerst. Für einen zweiten Edges-Fehler mit 1 bzw. e zurückwechseln.
    setActivePiece("corners");
  }, []);

  const removeDraft = useCallback((key: string) => {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }, []);

  const setComment = useCallback((key: string, value: string) => {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, comment: value } : d)));
  }, []);

  /** Tab bzw. "/" springt ins Kommentarfeld des zuletzt erfassten Fehlers. */
  const focusLastComment = useCallback(() => {
    const last = drafts[drafts.length - 1];
    const target = last ? commentRefs.current.get(last.key) : noteRef.current;
    if (target) window.setTimeout(() => target.focus(), 0);
  }, [drafts]);

  /**
   * Tastatur im Kommentarfeld: Enter schliesst den DNF ab, e und c wechseln
   * direkt zur jeweiligen Kategorie, Tab geht zum nächsten Kommentar.
   *
   * Weil e und c damit als Kommandos belegt sind, sind sie im Kommentar nur als
   * Grossbuchstabe tippbar: "EC" statt "ec".
   */
  const commentKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, draftKey: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveDnf(drafts, note);
        return;
      }
      // Nur die unmodifizierten Kleinbuchstaben – Shift+E/Shift+C bleiben Text.
      if ((e.key === "e" || e.key === "c") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setActivePiece(e.key === "e" ? "edges" : "corners");
        e.currentTarget.blur();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        // Reihum durch alle Kommentarfelder und zuletzt die Notiz.
        const targets = [
          ...drafts.map((d) => commentRefs.current.get(d.key) ?? null),
          noteRef.current,
        ];
        const idx = drafts.findIndex((d) => d.key === draftKey);
        targets[(idx + 1) % targets.length]?.focus();
      }
    },
    [drafts, note, saveDnf]
  );

  const quickCreate = useCallback(
    (phase: Phase) => {
      const name = addName.trim();
      if (!name) return;
      startTransition(async () => {
        const res = await createReason(phase, name, addKey.trim() || null);
        if (!res.ok) {
          flash({ kind: "err", text: res.error });
          return;
        }
        addDraft(res.reason, activePiece);
        setAddName("");
        setAddKey("");
        setAddOpen(null);
        flash({ kind: "ok", text: `„${res.reason.name}“ angelegt` });
      });
    },
    [addName, addKey, activePiece, addDraft, flash]
  );

  /* ------------------------------ Tastatur ------------------------------- */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      // Rückgängig funktioniert überall.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }

      if (inField) {
        if (e.key === "Escape") (target as HTMLElement).blur();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (mode === "idle") {
        if (e.key === " " || key === "s") {
          e.preventDefault();
          saveSuccess();
          return;
        }
        if (key === "d" || key === "f") {
          e.preventDefault();
          openDnf();
          return;
        }
        return;
      }

      // --- DNF-Panel ---
      if (e.key === "Escape") {
        e.preventDefault();
        resetPanel();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        saveDnf(drafts, note);
        return;
      }
      if (key === "1" || key === "e") {
        e.preventDefault();
        setActivePiece("edges");
        return;
      }
      if (key === "2" || key === "c") {
        e.preventDefault();
        setActivePiece("corners");
        return;
      }
      if (e.key === "Tab" || key === "/") {
        e.preventDefault();
        focusLastComment();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        setDrafts((prev) => prev.slice(0, -1));
        return;
      }

      const reason = shortcutMap.get(key);
      if (reason) {
        e.preventDefault();
        addDraft(reason, activePiece);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    mode,
    drafts,
    note,
    activePiece,
    shortcutMap,
    saveSuccess,
    saveDnf,
    resetPanel,
    openDnf,
    undo,
    addDraft,
    focusLastComment,
  ]);

  useEffect(() => {
    if (addOpen) window.setTimeout(() => addNameRef.current?.focus(), 0);
  }, [addOpen]);

  /* ------------------------------ Ableitungen ---------------------------- */

  const totalAttempts = data.totals.attempts + pendingSuccess + pendingDnf;
  const todayAttempts = data.today.attempts + pendingSuccess + pendingDnf;
  const goalDone = data.goal.done + pendingSuccess + pendingDnf;
  const goalPercent = data.goal.target > 0 ? Math.min(100, (goalDone / data.goal.target) * 100) : 0;
  const successCount = data.totals.success + pendingSuccess;
  const successRate = totalAttempts > 0 ? Math.round((successCount / totalAttempts) * 1000) / 10 : 0;

  const draftCountFor = useCallback(
    (piece: PieceType, reasonId: number) =>
      drafts.filter((d) => d.pieceType === piece && d.reasonId === reasonId).length,
    [drafts]
  );

  return (
    <div className="space-y-5">
      <GoalBar
        done={goalDone}
        target={data.goal.target}
        percent={goalPercent}
        daysLeft={data.goal.daysLeft}
        perDayNeeded={Math.max(0, Math.ceil(Math.max(0, data.goal.target - goalDone) / Math.max(1, data.goal.daysLeft)))}
        expected={data.goal.expectedByNow}
        todayAttempts={todayAttempts}
      />

      {mode === "idle" ? (
        <IdleScreen
          onSuccess={saveSuccess}
          onDnf={openDnf}
          successRate={successRate}
          totalAttempts={totalAttempts}
          successCount={successCount}
          dnfCount={data.totals.dnf + pendingDnf}
          recent={data.recent}
          onUndo={undo}
          busy={isPending}
        />
      ) : (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black tracking-tight">
              <span className="text-danger">DNF</span>{" "}
              <span className="text-muted font-medium">– was ist passiert?</span>
            </h2>
            <button
              onClick={resetPanel}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-white"
            >
              Abbrechen <kbd className="ml-1 opacity-70">Esc</kbd>
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {(["edges", "corners"] as PieceType[]).map((piece) => (
              <PieceColumn
                key={piece}
                piece={piece}
                active={activePiece === piece}
                onActivate={() => setActivePiece(piece)}
                reasons={data.reasons}
                shortcutMap={shortcutMap}
                // Ein Klick erfasst den Fehler in der geklickten Spalte;
                // addDraft schaltet danach selbst auf Corners weiter.
                onPick={(reason) => addDraft(reason, piece)}
                countFor={(reasonId) => draftCountFor(piece, reasonId)}
                addOpen={activePiece === piece ? addOpen : null}
                onToggleAdd={(phase) => {
                  setActivePiece(piece);
                  setAddOpen((cur) => (cur === phase ? null : phase));
                }}
                addName={addName}
                setAddName={setAddName}
                addKey={addKey}
                setAddKey={setAddKey}
                onQuickCreate={quickCreate}
                addNameRef={addNameRef}
              />
            ))}
          </div>

          <DraftList
            drafts={drafts}
            onRemove={removeDraft}
            onComment={setComment}
            onCommentKeyDown={commentKeyDown}
            commentRefs={commentRefs}
          />

          <div className="rounded-xl border border-border bg-surface p-3">
            <input
              ref={noteRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveDnf(drafts, note);
                  return;
                }
                if (e.key === "Tab" && drafts.length > 0) {
                  e.preventDefault();
                  commentRefs.current.get(drafts[0].key)?.focus();
                }
              }}
              placeholder="Notiz zum Solve (optional)"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
            />
          </div>

          <div className="sticky bottom-3 z-10">
            <button
              onClick={() => saveDnf(drafts, note)}
              disabled={isPending}
              className="w-full rounded-2xl border border-danger/60 bg-danger/15 py-4 text-base font-black tracking-wide text-danger shadow-[0_0_20px_rgba(255,45,120,0.25)] transition hover:bg-danger/25 disabled:opacity-60"
            >
              DNF speichern
              {drafts.length > 0 && <span className="ml-2 opacity-80">· {drafts.length} Fehler</span>}
              <kbd className="ml-2 text-xs opacity-70">Enter</kbd>
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">
              Start bei Edges, nach jedem Fehler weiter zu Corners · <kbd>e</kbd>/<kbd>c</kbd> bzw.{" "}
              <kbd>1</kbd>/<kbd>2</kbd> wechseln · Buchstabe = Grund · <kbd>Tab</kbd> Kommentar zum
              letzten Fehler, dort <kbd>Enter</kbd> zum Abschliessen und <kbd>e</kbd>/<kbd>c</kbd>
              zum Weiterwechseln ·{" "}
              <kbd>⌫</kbd> letzten Fehler löschen · Enter ohne Auswahl = DNF ohne Grund
            </p>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur animate-fade-in ${
            toast.kind === "ok"
              ? "border-accent-2/50 bg-accent-2/15 text-accent-2"
              : "border-danger/50 bg-danger/15 text-danger"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Zielleiste ------------------------------- */

function GoalBar({
  done,
  target,
  percent,
  daysLeft,
  perDayNeeded,
  expected,
  todayAttempts,
}: {
  done: number;
  target: number;
  percent: number;
  daysLeft: number;
  perDayNeeded: number;
  expected: number;
  todayAttempts: number;
}) {
  const ahead = done >= expected;
  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-gradient text-3xl font-black tabular-nums">{done}</span>
          <span className="text-lg font-bold text-muted">/ {target}</span>
          <span className="text-xs font-medium uppercase tracking-widest text-muted">Attempts</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted">
          <span>
            Heute <span className="font-bold text-white tabular-nums">{todayAttempts}</span>
          </span>
          <span>
            Noch <span className="font-bold text-white tabular-nums">{daysLeft}</span> Tage
          </span>
          <span>
            Nötig <span className="font-bold text-white tabular-nums">{perDayNeeded}</span>/Tag
          </span>
          <span className={ahead ? "text-accent-2" : "text-yellow"}>
            {ahead ? "▲" : "▼"} {Math.abs(done - expected)} vs. Plan
          </span>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-purple transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------ Startbildschirm --------------------------- */

function IdleScreen({
  onSuccess,
  onDnf,
  successRate,
  totalAttempts,
  successCount,
  dnfCount,
  recent,
  onUndo,
  busy,
}: {
  onSuccess: () => void;
  onDnf: () => void;
  successRate: number;
  totalAttempts: number;
  successCount: number;
  dnfCount: number;
  recent: TrackerData["recent"];
  onUndo: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={onSuccess}
          disabled={busy}
          className="group rounded-3xl border-2 border-accent-2/50 bg-accent-2/10 py-14 transition active:scale-[0.98] hover:border-accent-2 hover:bg-accent-2/20 hover:shadow-neon-green disabled:opacity-60"
        >
          <div className="text-4xl font-black tracking-tight text-accent-2">SUCCESS</div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-accent-2/70">
            Leertaste
          </div>
        </button>
        <button
          onClick={onDnf}
          disabled={busy}
          className="group rounded-3xl border-2 border-danger/50 bg-danger/10 py-14 transition active:scale-[0.98] hover:border-danger hover:bg-danger/20 hover:shadow-[0_0_20px_rgba(255,45,120,0.45)] disabled:opacity-60"
        >
          <div className="text-4xl font-black tracking-tight text-danger">DNF</div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-danger/70">
            Taste D
          </div>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Success-Rate" value={`${successRate}%`} accent="text-accent-2" />
        <Stat label="Success" value={successCount} accent="text-white" />
        <Stat label="DNF" value={dnfCount} accent="text-danger" />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted">Letzte Versuche</h3>
          <button
            onClick={onUndo}
            disabled={busy || recent.length === 0}
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted transition hover:text-white disabled:opacity-40"
          >
            Rückgängig <kbd className="ml-1 opacity-70">Ctrl+Z</kbd>
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-muted">
            Noch keine Versuche. Leertaste für Success, <kbd>D</kbd> für DNF.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {recent.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    a.isDnf ? "bg-danger" : "bg-accent-2"
                  }`}
                />
                <span className="flex-1 leading-snug">
                  {a.isDnf ? (
                    a.errors.length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {a.errors.map((e, i) => (
                          <span
                            key={i}
                            className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${PIECE_STYLE[e.pieceType].border} ${PIECE_STYLE[e.pieceType].bg} ${PIECE_STYLE[e.pieceType].text}`}
                          >
                            {PIECE_LABEL[e.pieceType].slice(0, 1)} · {PHASE_LABEL[e.phase].slice(0, 4)} ·{" "}
                            {e.reasonName}
                            {e.comment ? <span className="opacity-70"> „{e.comment}“</span> : null}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted">DNF ohne Grund</span>
                    )
                  ) : (
                    <span className="text-accent-2/80">Success</span>
                  )}
                </span>
                <time className="shrink-0 text-[11px] tabular-nums text-muted">
                  {new Date(a.occurredAt).toLocaleTimeString("de-CH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <div className={`text-xl font-black tabular-nums ${accent}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-muted">{label}</div>
    </div>
  );
}

/* ------------------------------ Grund-Spalte ------------------------------ */

function PieceColumn({
  piece,
  active,
  onActivate,
  reasons,
  shortcutMap,
  onPick,
  countFor,
  addOpen,
  onToggleAdd,
  addName,
  setAddName,
  addKey,
  setAddKey,
  onQuickCreate,
  addNameRef,
}: {
  piece: PieceType;
  active: boolean;
  onActivate: () => void;
  reasons: { memo: Reason[]; exec: Reason[] };
  shortcutMap: Map<string, Reason>;
  onPick: (r: Reason) => void;
  countFor: (reasonId: number) => number;
  addOpen: Phase | null;
  onToggleAdd: (phase: Phase) => void;
  addName: string;
  setAddName: (v: string) => void;
  addKey: string;
  setAddKey: (v: string) => void;
  onQuickCreate: (phase: Phase) => void;
  addNameRef: React.RefObject<HTMLInputElement>;
}) {
  const s = PIECE_STYLE[piece];
  const activeShortcuts = new Set([...shortcutMap.entries()].map(([k, r]) => `${r.id}:${k}`));

  return (
    <section
      onClick={onActivate}
      className={`rounded-2xl border bg-surface p-3 transition ${
        active ? `${s.border} ${s.ring}` : "border-border opacity-80 hover:opacity-100"
      }`}
    >
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
          <h3 className={`text-sm font-black uppercase tracking-widest ${s.text}`}>
            {PIECE_LABEL[piece]}
          </h3>
        </div>
        <kbd
          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
            active ? `${s.border} ${s.text}` : "border-border text-muted"
          }`}
        >
          {piece === "edges" ? "E · 1" : "C · 2"}
        </kbd>
      </header>

      {(["memo", "exec"] as Phase[]).map((phase) => {
        const list = phase === "memo" ? reasons.memo : reasons.exec;
        return (
          <div key={phase} className="mb-2 last:mb-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                {PHASE_LABEL[phase]}
              </span>
              <span className="h-px flex-1 bg-border" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAdd(phase);
                }}
                className="rounded border border-border px-1.5 text-[11px] font-bold text-muted transition hover:text-white"
                title={`Neuen ${PHASE_LABEL[phase]}-Grund anlegen`}
              >
                +
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {list.map((r) => {
                const count = countFor(r.id);
                const sc = r.shortcut?.toLowerCase();
                const showKey = active && sc && activeShortcuts.has(`${r.id}:${sc}`);
                return (
                  <button
                    key={r.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPick(r);
                    }}
                    className={`group relative rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition active:scale-95 ${
                      count > 0
                        ? `${s.border} ${s.bg} ${s.text}`
                        : "border-border bg-surface-2 text-white/85 hover:border-white/25"
                    }`}
                  >
                    {r.name}
                    {showKey && (
                      <kbd className="ml-1.5 rounded bg-black/40 px-1 text-[10px] font-bold text-muted">
                        {sc}
                      </kbd>
                    )}
                    {count > 0 && (
                      <span
                        className={`ml-1.5 rounded-full px-1.5 text-[10px] font-black ${s.bg} ${s.text}`}
                      >
                        ×{count}
                      </span>
                    )}
                  </button>
                );
              })}
              {list.length === 0 && (
                <span className="text-xs text-muted">Noch keine Gründe – mit + anlegen.</span>
              )}
            </div>

            {addOpen === phase && (
              <div
                className="mt-2 flex gap-1.5 animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={addNameRef}
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onQuickCreate(phase);
                    }
                  }}
                  placeholder={`Neuer ${PHASE_LABEL[phase]}-Grund`}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent/60"
                />
                <input
                  value={addKey}
                  onChange={(e) => setAddKey(e.target.value.slice(0, 1))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onQuickCreate(phase);
                    }
                  }}
                  placeholder="Key"
                  className="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-center text-sm outline-none focus:border-accent/60"
                />
                <button
                  onClick={() => onQuickCreate(phase)}
                  className="rounded-lg border border-accent/50 bg-accent/10 px-3 text-sm font-bold text-accent"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

/* ---------------------------- Erfasste Fehler ----------------------------- */

function DraftList({
  drafts,
  onRemove,
  onComment,
  onCommentKeyDown,
  commentRefs,
}: {
  drafts: Draft[];
  onRemove: (key: string) => void;
  onComment: (key: string, value: string) => void;
  onCommentKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, draftKey: string) => void;
  commentRefs: React.MutableRefObject<Map<string, HTMLInputElement | null>>;
}) {
  if (drafts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
        Noch kein Grund gewählt. Mehrfach tippen für mehrere Fehler – Edges und Corners
        gleichzeitig sind kein Problem.
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {drafts.map((d) => {
        const s = PIECE_STYLE[d.pieceType];
        return (
          <li
            key={d.key}
            className={`flex items-center gap-2 rounded-xl border bg-surface px-2.5 py-2 ${s.border}`}
          >
            <span className={`shrink-0 text-xs font-bold uppercase tracking-wider ${s.text}`}>
              {PIECE_LABEL[d.pieceType]}
            </span>
            <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              {PHASE_LABEL[d.phase]}
            </span>
            <span className="shrink-0 text-sm font-semibold">{d.reasonName}</span>
            <input
              ref={(el) => {
                commentRefs.current.set(d.key, el);
              }}
              value={d.comment}
              onChange={(e) => onComment(d.key, e.target.value)}
              onKeyDown={(e) => onCommentKeyDown(e, d.key)}
              placeholder="Kommentar, z.B. welcher Comm"
              className="min-w-0 flex-1 rounded-lg bg-surface-2 px-2 py-1 text-sm outline-none placeholder:text-muted/60 focus:ring-1 focus:ring-accent/40"
            />
            <button
              onClick={() => onRemove(d.key)}
              className="shrink-0 rounded-lg px-2 py-1 text-sm text-muted transition hover:text-danger"
              title="Fehler entfernen"
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}
