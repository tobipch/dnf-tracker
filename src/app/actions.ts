"use server";

import { db } from "@/db";
import { macroCategories, subCategories, dnfEntries } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function normalizeShortcut(raw: FormDataEntryValue | null | undefined): string | null {
  const s = (raw ?? "").toString().trim().toLowerCase();
  if (!s) return null;
  // Only keep a single character as a shortcut.
  return s.slice(0, 1);
}

/* ----------------------------- DNF recording ----------------------------- */

export async function recordDnf(
  pieceType: "edges" | "corners",
  macroId: number,
  subId: number | null
): Promise<ActionResult> {
  if (pieceType !== "edges" && pieceType !== "corners") return { ok: false, error: "Ungültiger Piece-Typ." };
  if (!Number.isInteger(macroId)) return { ok: false, error: "Ungültige Makro-Kategorie." };

  const subs = await db
    .select({ id: subCategories.id })
    .from(subCategories)
    .where(eq(subCategories.macroId, macroId));

  if (subs.length > 0) {
    if (subId === null) return { ok: false, error: "Bitte eine Unterkategorie auswählen." };
    if (!subs.some((s) => s.id === subId)) return { ok: false, error: "Unterkategorie gehört nicht zu dieser Makro-Kategorie." };
  } else {
    subId = null;
  }

  await db.insert(dnfEntries).values({ pieceType, macroId, subId });
  revalidatePath("/");
  revalidatePath("/stats");
  return { ok: true };
}

export async function undoLastDnf(): Promise<ActionResult> {
  const last = await db
    .select({ id: dnfEntries.id })
    .from(dnfEntries)
    .orderBy(sql`${dnfEntries.occurredAt} desc, ${dnfEntries.id} desc`)
    .limit(1);
  if (last.length === 0) return { ok: false, error: "Kein DNF zum Rückgängigmachen." };
  await db.delete(dnfEntries).where(eq(dnfEntries.id, last[0].id));
  revalidatePath("/");
  revalidatePath("/stats");
  return { ok: true, message: "Letzter DNF entfernt." };
}

export type QuickCreateResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

/** Creates a macro category on-the-fly and returns its id. */
export async function quickCreateMacro(
  name: string,
  shortcut: string | null
): Promise<QuickCreateResult> {
  const n = name.trim();
  if (!n) return { ok: false, error: "Name darf nicht leer sein." };
  const s = shortcut?.trim().toLowerCase().slice(0, 1) || null;

  const max = await db
    .select({ max: sql<number>`coalesce(max(${macroCategories.position}), -1)` })
    .from(macroCategories);
  const position = (max[0]?.max ?? -1) + 1;

  const rows = await db
    .insert(macroCategories)
    .values({ name: n, shortcut: s, position })
    .returning({ id: macroCategories.id });

  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true, id: rows[0].id };
}

/** Creates a sub category on-the-fly and returns its id. */
export async function quickCreateSub(
  macroId: number,
  name: string,
  shortcut: string | null
): Promise<QuickCreateResult> {
  const n = name.trim();
  if (!n) return { ok: false, error: "Name darf nicht leer sein." };
  const s = shortcut?.trim().toLowerCase().slice(0, 1) || null;

  const max = await db
    .select({ max: sql<number>`coalesce(max(${subCategories.position}), -1)` })
    .from(subCategories)
    .where(eq(subCategories.macroId, macroId));
  const position = (max[0]?.max ?? -1) + 1;

  const rows = await db
    .insert(subCategories)
    .values({ macroId, name: n, shortcut: s, position })
    .returning({ id: subCategories.id });

  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true, id: rows[0].id };
}



export async function createMacro(formData: FormData): Promise<ActionResult> {
  const name = (formData.get("name") ?? "").toString().trim();
  if (!name) return { ok: false, error: "Name darf nicht leer sein." };
  const shortcut = normalizeShortcut(formData.get("shortcut"));

  const max = await db
    .select({ max: sql<number>`coalesce(max(${macroCategories.position}), -1)` })
    .from(macroCategories);
  const position = (max[0]?.max ?? -1) + 1;

  await db.insert(macroCategories).values({ name, shortcut, position });
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateMacro(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const name = (formData.get("name") ?? "").toString().trim();
  if (!Number.isInteger(id)) return { ok: false, error: "Ungültige ID." };
  if (!name) return { ok: false, error: "Name darf nicht leer sein." };
  const shortcut = normalizeShortcut(formData.get("shortcut"));

  await db.update(macroCategories).set({ name, shortcut }).where(eq(macroCategories.id, id));
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteMacro(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, error: "Ungültige ID." };
  await db.delete(macroCategories).where(eq(macroCategories.id, id));
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export async function moveMacro(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const direction = (formData.get("direction") ?? "").toString();
  if (!Number.isInteger(id)) return { ok: false, error: "Ungültige ID." };

  const all = await db
    .select()
    .from(macroCategories)
    .orderBy(sql`${macroCategories.position} asc, ${macroCategories.id} asc`);
  const idx = all.findIndex((m) => m.id === id);
  if (idx === -1) return { ok: false, error: "Nicht gefunden." };
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= all.length) return { ok: true };

  const a = all[idx];
  const b = all[swapWith];
  await Promise.all([
    db.update(macroCategories).set({ position: b.position }).where(eq(macroCategories.id, a.id)),
    db.update(macroCategories).set({ position: a.position }).where(eq(macroCategories.id, b.id)),
  ]);
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

/* ---------------------------- Sub categories ----------------------------- */

export async function createSub(formData: FormData): Promise<ActionResult> {
  const macroId = Number(formData.get("macroId"));
  const name = (formData.get("name") ?? "").toString().trim();
  if (!Number.isInteger(macroId)) return { ok: false, error: "Ungültige Makro-Kategorie." };
  if (!name) return { ok: false, error: "Name darf nicht leer sein." };
  const shortcut = normalizeShortcut(formData.get("shortcut"));

  const max = await db
    .select({ max: sql<number>`coalesce(max(${subCategories.position}), -1)` })
    .from(subCategories)
    .where(eq(subCategories.macroId, macroId));
  const position = (max[0]?.max ?? -1) + 1;

  await db.insert(subCategories).values({ macroId, name, shortcut, position });
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateSub(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const name = (formData.get("name") ?? "").toString().trim();
  if (!Number.isInteger(id)) return { ok: false, error: "Ungültige ID." };
  if (!name) return { ok: false, error: "Name darf nicht leer sein." };
  const shortcut = normalizeShortcut(formData.get("shortcut"));

  await db.update(subCategories).set({ name, shortcut }).where(eq(subCategories.id, id));
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteSub(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, error: "Ungültige ID." };
  await db.delete(subCategories).where(eq(subCategories.id, id));
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export async function moveSub(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const direction = (formData.get("direction") ?? "").toString();
  if (!Number.isInteger(id)) return { ok: false, error: "Ungültige ID." };

  const sub = await db.select().from(subCategories).where(eq(subCategories.id, id)).limit(1);
  if (sub.length === 0) return { ok: false, error: "Nicht gefunden." };

  const siblings = await db
    .select()
    .from(subCategories)
    .where(eq(subCategories.macroId, sub[0].macroId))
    .orderBy(sql`${subCategories.position} asc, ${subCategories.id} asc`);
  const idx = siblings.findIndex((s) => s.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= siblings.length) return { ok: true };

  const a = siblings[idx];
  const b = siblings[swapWith];
  await Promise.all([
    db.update(subCategories).set({ position: b.position }).where(eq(subCategories.id, a.id)),
    db.update(subCategories).set({ position: a.position }).where(eq(subCategories.id, b.id)),
  ]);
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}
