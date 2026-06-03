"use client";

import { useState, useTransition } from "react";
import type { MacroWithSubs } from "@/db/queries";
import {
  createMacro,
  updateMacro,
  deleteMacro,
  moveMacro,
  createSub,
  updateSub,
  deleteSub,
  moveSub,
  type ActionResult,
} from "@/app/actions";

export default function SettingsManager({ macros }: { macros: MacroWithSubs[] }) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: (fd: FormData) => Promise<ActionResult>, fd: FormData, onOk?: () => void) => {
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error);
      else {
        setError(null);
        onOk?.();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          Kategorien <span className="text-gradient">&amp; Shortcuts</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Lege Makro-Kategorien und Unterkategorien an. Leeres Shortcut-Feld → automatisch{" "}
          <kbd className="rounded border border-border bg-surface-2 px-1">1</kbd>,{" "}
          <kbd className="rounded border border-border bg-surface-2 px-1">2</kbd> …
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          style={{ boxShadow: "0 0 16px rgba(255,45,120,0.15)" }}>
          {error}
        </div>
      )}

      {/* New macro */}
      <form
        action={(fd) => run(createMacro, fd, () => (document.getElementById("new-macro-form") as HTMLFormElement)?.reset())}
        id="new-macro-form"
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-accent/25 bg-accent/[0.04] p-4"
        style={{ boxShadow: "0 0 20px rgba(0,212,255,0.06)" }}
      >
        <Field label="Neue Makro-Kategorie" name="name" placeholder="z.B. Memo-Fehler" className="min-w-[200px] flex-1" />
        <Field label="Shortcut" name="shortcut" placeholder="1" maxLength={1} className="w-20" />
        <button className="rounded-xl border border-accent/40 bg-accent/15 px-4 py-2 text-sm font-bold text-accent transition-all hover:bg-accent/25 hover:shadow-neon-blue-sm">
          + Hinzufügen
        </button>
      </form>

      {/* Macro list */}
      <div className="space-y-4">
        {macros.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-8 text-center text-muted">
            Noch keine Kategorien angelegt. Leg oben los!
          </p>
        )}

        {macros.map((m, i) => (
          <div key={m.id} className="rounded-2xl border border-border/70 bg-surface/70 backdrop-blur">
            {/* Macro row */}
            <div className="flex flex-wrap items-end gap-2 border-b border-border p-4">
              <form
                action={(fd) => run(updateMacro, fd)}
                className="flex flex-1 flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={m.id} />
                <Field label="Makro-Kategorie" name="name" defaultValue={m.name} className="min-w-[200px] flex-1" />
                <Field label="Shortcut" name="shortcut" defaultValue={m.shortcut ?? ""} maxLength={1} className="w-20" placeholder={String(i + 1)} />
                <button className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm font-medium transition-all hover:border-accent/60 hover:text-accent">
                  Speichern
                </button>
              </form>
              <div className="flex items-center gap-1">
                <IconForm action={(fd) => run(moveMacro, fd)} id={m.id} extra={{ direction: "up" }} label="▲" disabled={i === 0} />
                <IconForm action={(fd) => run(moveMacro, fd)} id={m.id} extra={{ direction: "down" }} label="▼" disabled={i === macros.length - 1} />
                <DeleteButton
                  action={(fd) => run(deleteMacro, fd)}
                  id={m.id}
                  confirmText={`Makro-Kategorie "${m.name}" und alle zugehörigen Einträge löschen?`}
                />
              </div>
            </div>

            {/* Sub categories */}
            <div className="space-y-2 p-4">
              {m.subs.map((s, j) => (
                <div key={s.id} className="flex flex-wrap items-end gap-2">
                  <form action={(fd) => run(updateSub, fd)} className="flex flex-1 flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <span className="pb-2 text-xs text-muted">↳</span>
                    <Field label="" name="name" defaultValue={s.name} className="min-w-[180px] flex-1" />
                    <Field label="" name="shortcut" defaultValue={s.shortcut ?? ""} maxLength={1} className="w-16" placeholder={String(j + 1)} />
                    <button className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm font-medium transition-all hover:border-accent-2/60 hover:text-accent-2">
                      Speichern
                    </button>
                  </form>
                  <div className="flex items-center gap-1">
                    <IconForm action={(fd) => run(moveSub, fd)} id={s.id} extra={{ direction: "up" }} label="▲" disabled={j === 0} />
                    <IconForm action={(fd) => run(moveSub, fd)} id={s.id} extra={{ direction: "down" }} label="▼" disabled={j === m.subs.length - 1} />
                    <DeleteButton action={(fd) => run(deleteSub, fd)} id={s.id} confirmText={`Unterkategorie "${s.name}" löschen?`} />
                  </div>
                </div>
              ))}

              {/* New sub */}
              <form
                action={(fd) => run(createSub, fd, () => (document.getElementById(`new-sub-${m.id}`) as HTMLFormElement)?.reset())}
                id={`new-sub-${m.id}`}
                className="flex flex-wrap items-end gap-2 pt-1"
              >
                <input type="hidden" name="macroId" value={m.id} />
                <span className="pb-2 text-xs text-muted">+</span>
                <Field label="" name="name" placeholder="Neue Unterkategorie" className="min-w-[180px] flex-1" />
                <Field label="" name="shortcut" placeholder="#" maxLength={1} className="w-16" />
                <button className="rounded-xl border border-dashed border-accent-2/20 px-3 py-2 text-sm text-muted transition-all hover:border-accent-2/60 hover:text-accent-2">
                  + Sub
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  maxLength,
  className = "",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      {label && <span className="text-xs text-muted">{label}</span>}
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        className="rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent/60 focus:shadow-neon-blue-sm"
      />
    </label>
  );
}

function IconForm({
  action,
  id,
  extra,
  label,
  disabled,
}: {
  action: (fd: FormData) => void;
  id: number;
  extra: Record<string, string>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {Object.entries(extra).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        disabled={disabled}
        className="rounded-lg border border-border/60 bg-surface-2 px-2 py-2 text-xs leading-none transition-all hover:border-accent/50 disabled:opacity-25"
      >
        {label}
      </button>
    </form>
  );
}

function DeleteButton({
  action,
  id,
  confirmText,
}: {
  action: (fd: FormData) => void;
  id: number;
  confirmText: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="rounded-lg border border-danger/30 bg-danger/8 px-2 py-2 text-xs leading-none text-danger transition-all hover:bg-danger/20 hover:border-danger/60">
        ✕
      </button>
    </form>
  );
}
