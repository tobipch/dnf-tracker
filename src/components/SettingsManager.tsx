"use client";

import { useState, useTransition } from "react";
import type { Reason, Phase } from "@/db/schema";
import type { Goal } from "@/db/queries";
import {
  createReasonForm,
  updateReason,
  deleteReason,
  moveReason,
  setReasonArchived,
  updateGoal,
  resetSolves,
  type ActionResult,
} from "@/app/actions";

const PHASE_LABEL: Record<Phase, string> = { memo: "Memo", exec: "Execution" };

type Msg = { kind: "ok" | "err"; text: string } | null;

export default function SettingsManager({
  reasons,
  goal,
  counts,
}: {
  reasons: Reason[];
  goal: Goal;
  counts: { attempts: number; errors: number };
}) {
  const [msg, setMsg] = useState<Msg>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<ActionResult>, fd: FormData, form?: HTMLFormElement) {
    startTransition(async () => {
      const res = await action(fd);
      if (res.ok) {
        setMsg({ kind: "ok", text: res.message ?? "Gespeichert." });
        form?.reset();
      } else {
        setMsg({ kind: "err", text: res.error });
      }
      window.setTimeout(() => setMsg(null), 3000);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          Einstellungen <span className="text-gradient">Setup</span>
        </h1>
        <p className="text-sm text-muted">Ziel, Fehlergründe und Daten verwalten.</p>
      </div>

      {msg && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
            msg.kind === "ok"
              ? "border-accent-2/50 bg-accent-2/10 text-accent-2"
              : "border-danger/50 bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Ziel */}
      <Card title="Ziel">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(updateGoal, new FormData(e.currentTarget));
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="Attempts">
            <input
              name="target"
              type="number"
              min={1}
              defaultValue={goal.target}
              className="w-28 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent/60"
            />
          </Field>
          <Field label="Von">
            <input
              name="start"
              type="date"
              defaultValue={goal.start}
              className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent/60"
            />
          </Field>
          <Field label="Bis">
            <input
              name="end"
              type="date"
              defaultValue={goal.end}
              className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent/60"
            />
          </Field>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-1.5 text-sm font-bold text-accent disabled:opacity-50"
          >
            Speichern
          </button>
        </form>
      </Card>

      {/* Gründe */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(["memo", "exec"] as Phase[]).map((phase) => {
          const list = reasons.filter((r) => r.phase === phase);
          return (
            <Card key={phase} title={`${PHASE_LABEL[phase]}-Gründe`}>
              <ul className="mb-3 space-y-1.5">
                {list.map((r, i) => (
                  <li
                    key={r.id}
                    className={`flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 p-1.5 ${
                      r.archived ? "opacity-50" : ""
                    }`}
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(updateReason, new FormData(e.currentTarget));
                      }}
                      className="flex min-w-0 flex-1 items-center gap-1.5"
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <input
                        name="name"
                        defaultValue={r.name}
                        className="min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 text-sm font-semibold outline-none focus:bg-surface"
                      />
                      <input
                        name="shortcut"
                        defaultValue={r.shortcut ?? ""}
                        maxLength={1}
                        placeholder="–"
                        title="Tastatur-Shortcut"
                        className="w-9 rounded-lg border border-border bg-surface px-1 py-1 text-center text-xs font-bold outline-none focus:border-accent/60"
                      />
                      <button
                        type="submit"
                        className="rounded-lg px-1.5 py-1 text-xs text-muted transition hover:text-accent"
                        title="Speichern"
                      >
                        ✓
                      </button>
                    </form>

                    <IconForm action={moveReason} run={run} id={r.id} extra={{ direction: "up" }} disabled={i === 0} label="↑" />
                    <IconForm
                      action={moveReason}
                      run={run}
                      id={r.id}
                      extra={{ direction: "down" }}
                      disabled={i === list.length - 1}
                      label="↓"
                    />
                    <IconForm
                      action={setReasonArchived}
                      run={run}
                      id={r.id}
                      extra={{ archived: String(!r.archived) }}
                      label={r.archived ? "↺" : "⊘"}
                      title={r.archived ? "Reaktivieren" : "Archivieren (bleibt in der Statistik)"}
                    />
                    <IconForm action={deleteReason} run={run} id={r.id} label="✕" danger title="Löschen" />
                  </li>
                ))}
                {list.length === 0 && <li className="text-sm text-muted">Noch keine Gründe.</li>}
              </ul>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  run(createReasonForm, new FormData(form), form);
                }}
                className="flex gap-1.5"
              >
                <input type="hidden" name="phase" value={phase} />
                <input
                  name="name"
                  placeholder={`Neuer ${PHASE_LABEL[phase]}-Grund`}
                  required
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent/60"
                />
                <input
                  name="shortcut"
                  maxLength={1}
                  placeholder="Key"
                  className="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-center text-sm outline-none focus:border-accent/60"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg border border-accent/50 bg-accent/10 px-3 text-sm font-bold text-accent disabled:opacity-50"
                >
                  +
                </button>
              </form>
              <p className="mt-2 text-[11px] text-muted">
                Die Tasten <kbd>1</kbd>, <kbd>2</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd>,{" "}
                <kbd>Leertaste</kbd>, <kbd>⌫</kbd> und <kbd>/</kbd> sind vom Tracker belegt.
              </p>
            </Card>
          );
        })}
      </div>

      {/* Reset */}
      <Card title="Daten zurücksetzen" danger>
        <p className="mb-3 text-sm text-muted">
          Löscht alle {counts.attempts} Versuche inklusive {counts.errors} erfasster Fehler und
          Kommentare. Gründe und Ziel bleiben erhalten. Das lässt sich nicht rückgängig machen.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            run(resetSolves, new FormData(form), form);
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            name="confirm"
            placeholder="RESET eintippen"
            autoComplete="off"
            className="w-48 rounded-lg border border-danger/40 bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-danger"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg border border-danger/60 bg-danger/15 px-4 py-1.5 text-sm font-bold text-danger disabled:opacity-50"
          >
            Alle Solves löschen
          </button>
        </form>
      </Card>
    </div>
  );
}

function IconForm({
  action,
  run,
  id,
  extra,
  label,
  disabled,
  danger,
  title,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  run: (a: (fd: FormData) => Promise<ActionResult>, fd: FormData) => void;
  id: number;
  extra?: Record<string, string>;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(action, new FormData(e.currentTarget));
      }}
    >
      <input type="hidden" name="id" value={id} />
      {extra &&
        Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button
        type="submit"
        disabled={disabled}
        title={title}
        className={`rounded-lg px-1.5 py-1 text-xs transition disabled:opacity-25 ${
          danger ? "text-muted hover:text-danger" : "text-muted hover:text-white"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</span>
      {children}
    </label>
  );
}

function Card({
  title,
  children,
  danger,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-surface/70 p-5 backdrop-blur ${
        danger ? "border-danger/40" : "border-border/70"
      }`}
    >
      <div
        className={`mb-4 text-xs font-bold uppercase tracking-widest ${
          danger ? "text-danger" : "text-muted"
        }`}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
