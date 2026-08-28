"use server";

import { db } from "@/db";
import { reasons, attempts, attemptErrors, appSettings } from "@/db/schema";
import type { PieceType, Phase, Reason } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { SETTING_KEYS } from "@/db/seed";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/settings");
}

function normalizeShortcut(raw: unknown): string | null {
  const s = (raw ?? "").toString().trim().toLowerCase();
  if (!s) return null;
  return s.slice(0, 1);
}

function isPiece(v: unknown): v is PieceType {
  return v === "edges" || v === "corners";
}

function isPhase(v: unknown): v is Phase {
  return v === "memo" || v === "exec";
}

/* ---------------------------- Attempts erfassen --------------------------- */

export type ErrorInput = {
  pieceType: PieceType;
  phase: Phase;
  reasonId: number | null;
  comment?: string | null;
};

export type RecordResult = { ok: true; attemptId: number } | { ok: false; error: string };

/**
 * Speichert einen Versuch. Bei einem DNF können beliebig viele Fehler
 * mitgegeben werden – auch mehrere in derselben Kategorie.
 */
export async function recordAttempt(input: {
  isDnf: boolean;
  note?: string | null;
  timeMs?: number | null;
  scramble?: string | null;
  errors?: ErrorInput[];
}): Promise<RecordResult> {
  const errors = input.isDnf ? input.errors ?? [] : [];

  for (const e of errors) {
    if (!isPiece(e.pieceType)) return { ok: false, error: "Ungültige Kategorie (Edges/Corners)." };
    if (!isPhase(e.phase)) return { ok: false, error: "Ungültige Phase (Memo/Execution)." };
  }

  const ids = [...new Set(errors.map((e) => e.reasonId).filter((id): id is number => id !== null))];
  const known = new Map<number, Reason>();
  if (ids.length > 0) {
    const rows = await db.select().from(reasons);
    for (const r of rows) known.set(r.id, r);
    for (const id of ids) {
      if (!known.has(id)) return { ok: false, error: "Unbekannter Grund." };
    }
  }

  const note = (input.note ?? "").toString().trim() || null;
  const scramble = (input.scramble ?? "").toString().trim() || null;

  const rawTime = input.timeMs;
  const timeMs =
    typeof rawTime === "number" && Number.isFinite(rawTime) && rawTime > 0
      ? Math.round(rawTime)
      : null;

  const inserted = await db
    .insert(attempts)
    .values({ isDnf: input.isDnf, note, timeMs, scramble })
    .returning({ id: attempts.id });
  const attemptId = inserted[0].id;

  if (errors.length > 0) {
    await db.insert(attemptErrors).values(
      errors.map((e) => {
        const reason = e.reasonId !== null ? known.get(e.reasonId) : undefined;
        return {
          attemptId,
          pieceType: e.pieceType,
          phase: e.phase,
          reasonId: reason?.id ?? null,
          reasonName: reason?.name ?? "Ohne Grund",
          comment: (e.comment ?? "").toString().trim() || null,
        };
      })
    );
  }

  revalidateAll();
  return { ok: true, attemptId };
}

/** Entfernt den zuletzt erfassten Versuch (inkl. seiner Fehler). */
export async function undoLastAttempt(): Promise<ActionResult> {
  const last = await db
    .select({ id: attempts.id, isDnf: attempts.isDnf })
    .from(attempts)
    .orderBy(sql`${attempts.occurredAt} desc, ${attempts.id} desc`)
    .limit(1);

  if (last.length === 0) return { ok: false, error: "Kein Versuch zum Rückgängigmachen." };

  await db.delete(attempts).where(eq(attempts.id, last[0].id));
  revalidateAll();
  return { ok: true, message: last[0].isDnf ? "Letzter DNF entfernt." : "Letzter Success entfernt." };
}

export async function deleteAttempt(id: number): Promise<ActionResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "Ungültige ID." };
  await db.delete(attempts).where(eq(attempts.id, id));
  revalidateAll();
  return { ok: true, message: "Versuch gelöscht." };
}

/* -------------------------------- Gründe --------------------------------- */

export type CreateReasonResult = { ok: true; reason: Reason } | { ok: false; error: string };

/**
 * Legt einen neuen Grund an. Wird sowohl von den Einstellungen als auch vom
 * Schnell-Anlegen direkt im Tracker verwendet.
 */
export async function createReason(
  phase: Phase,
  name: string,
  shortcut: string | null
): Promise<CreateReasonResult> {
  if (!isPhase(phase)) return { ok: false, error: "Ungültige Phase." };
  const n = name.trim();
  if (!n) return { ok: false, error: "Name darf nicht leer sein." };

  const existing = await db.select().from(reasons);
  if (existing.some((r) => r.phase === phase && r.name.toLowerCase() === n.toLowerCase())) {
    return { ok: false, error: "Dieser Grund existiert bereits." };
  }

  let sc = normalizeShortcut(shortcut);
  if (sc && existing.some((r) => r.shortcut === sc)) sc = null; // Konflikt → lieber kein Shortcut

  const position = existing.reduce((max, r) => Math.max(max, r.position), -1) + 1;

  const rows = await db
    .insert(reasons)
    .values({ phase, name: n, shortcut: sc, position })
    .returning();

  revalidateAll();
  return { ok: true, reason: rows[0] };
}

export async function createReasonForm(formData: FormData): Promise<ActionResult> {
  const phase = formData.get("phase");
  if (!isPhase(phase)) return { ok: false, error: "Ungültige Phase." };
  const res = await createReason(
    phase,
    (formData.get("name") ?? "").toString(),
    normalizeShortcut(formData.get("shortcut"))
  );
  return res.ok ? { ok: true } : res;
}

export async function updateReason(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const name = (formData.get("name") ?? "").toString().trim();
  if (!Number.isInteger(id)) return { ok: false, error: "Ungültige ID." };
  if (!name) return { ok: false, error: "Name darf nicht leer sein." };

  const shortcut = normalizeShortcut(formData.get("shortcut"));
  if (shortcut) {
    const clash = await db.select().from(reasons).where(eq(reasons.shortcut, shortcut));
    if (clash.some((r) => r.id !== id)) {
      return { ok: false, error: `Shortcut „${shortcut}“ ist bereits vergeben.` };
    }
  }

  await db.update(reasons).set({ name, shortcut }).where(eq(reasons.id, id));
  revalidateAll();
  return { ok: true };
}

export async function setReasonArchived(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const archived = (formData.get("archived") ?? "").toString() === "true";
  if (!Number.isInteger(id)) return { ok: false, error: "Ungültige ID." };
  await db.update(reasons).set({ archived }).where(eq(reasons.id, id));
  revalidateAll();
  return { ok: true, message: archived ? "Grund archiviert." : "Grund reaktiviert." };
}

/** Löscht einen Grund. Bereits erfasste Fehler behalten ihren Namen. */
export async function deleteReason(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, error: "Ungültige ID." };
  await db.delete(reasons).where(eq(reasons.id, id));
  revalidateAll();
  return { ok: true, message: "Grund gelöscht." };
}

export async function moveReason(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const direction = (formData.get("direction") ?? "").toString();
  if (!Number.isInteger(id)) return { ok: false, error: "Ungültige ID." };

  const current = await db.select().from(reasons).where(eq(reasons.id, id)).limit(1);
  if (current.length === 0) return { ok: false, error: "Nicht gefunden." };

  const siblings = await db
    .select()
    .from(reasons)
    .where(eq(reasons.phase, current[0].phase))
    .orderBy(sql`${reasons.position} asc, ${reasons.id} asc`);

  const idx = siblings.findIndex((r) => r.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= siblings.length) return { ok: true };

  const a = siblings[idx];
  const b = siblings[swapWith];
  await Promise.all([
    db.update(reasons).set({ position: b.position }).where(eq(reasons.id, a.id)),
    db.update(reasons).set({ position: a.position }).where(eq(reasons.id, b.id)),
  ]);
  revalidateAll();
  return { ok: true };
}

/* --------------------------------- Ziel ---------------------------------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function updateGoal(formData: FormData): Promise<ActionResult> {
  const target = Number(formData.get("target"));
  const start = (formData.get("start") ?? "").toString();
  const end = (formData.get("end") ?? "").toString();

  if (!Number.isInteger(target) || target < 1) return { ok: false, error: "Ziel muss eine positive Zahl sein." };
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return { ok: false, error: "Ungültiges Datum." };
  if (end < start) return { ok: false, error: "Das Enddatum liegt vor dem Startdatum." };

  const values = [
    { key: SETTING_KEYS.goalTarget, value: String(target) },
    { key: SETTING_KEYS.goalStart, value: start },
    { key: SETTING_KEYS.goalEnd, value: end },
  ];

  for (const v of values) {
    await db
      .insert(appSettings)
      .values(v)
      .onConflictDoUpdate({ target: appSettings.key, set: { value: v.value } });
  }

  revalidateAll();
  return { ok: true, message: "Ziel aktualisiert." };
}

/* --------------------------------- Reset --------------------------------- */

/**
 * Löscht alle erfassten Versuche inklusive Fehler und Kommentare.
 * Gründe und Ziel-Einstellungen bleiben erhalten.
 */
export async function resetSolves(formData: FormData): Promise<ActionResult> {
  const confirm = (formData.get("confirm") ?? "").toString().trim().toUpperCase();
  if (confirm !== "RESET") {
    return { ok: false, error: "Zum Bestätigen bitte RESET eintippen." };
  }

  const deleted = await db.delete(attempts).returning({ id: attempts.id });
  revalidateAll();
  return { ok: true, message: `${deleted.length} Versuche gelöscht.` };
}
