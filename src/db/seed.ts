import { db } from "./index";
import { reasons, appSettings } from "./schema";
import { sql } from "drizzle-orm";
import type { Phase } from "./schema";

/**
 * Startset an Gründen. Die Liste ist bewusst nicht abschliessend – neue Gründe
 * können jederzeit im Tracker oder unter /settings ergänzt werden.
 */
export const DEFAULT_REASONS: { phase: Phase; name: string; shortcut: string }[] = [
  { phase: "memo", name: "Vergessen", shortcut: "v" },
  { phase: "memo", name: "Reihenfolge", shortcut: "r" },
  { phase: "memo", name: "Tracing", shortcut: "t" },
  { phase: "exec", name: "Mismove", shortcut: "m" },
  { phase: "exec", name: "Commutator", shortcut: "k" },
  { phase: "exec", name: "LTCT", shortcut: "l" },
  { phase: "exec", name: "Buffer", shortcut: "b" },
];

export const SETTING_KEYS = {
  goalTarget: "goal_target",
  goalStart: "goal_start",
  goalEnd: "goal_end",
} as const;

export const DEFAULT_GOAL_TARGET = 1000;
/** Länge des Ziel-Zeitraums in Tagen, wenn er zum ersten Mal angelegt wird. */
export const DEFAULT_GOAL_DAYS = 30;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Legt Standard-Gründe und Standard-Ziel an, falls noch nichts existiert.
 * Idempotent – kann bei jedem Request laufen.
 */
export async function ensureSeeded(): Promise<void> {
  const [reasonCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reasons);

  if ((reasonCount?.count ?? 0) === 0) {
    await db.insert(reasons).values(
      DEFAULT_REASONS.map((r, i) => ({
        phase: r.phase,
        name: r.name,
        shortcut: r.shortcut,
        position: i,
      }))
    );
  }

  const existing = await db.select().from(appSettings);
  const have = new Set(existing.map((s) => s.key));

  const start = new Date();
  const end = new Date(start.getTime() + DEFAULT_GOAL_DAYS * 24 * 60 * 60 * 1000);

  const defaults: { key: string; value: string }[] = [
    { key: SETTING_KEYS.goalTarget, value: String(DEFAULT_GOAL_TARGET) },
    { key: SETTING_KEYS.goalStart, value: isoDate(start) },
    { key: SETTING_KEYS.goalEnd, value: isoDate(end) },
  ];

  const missing = defaults.filter((d) => !have.has(d.key));
  if (missing.length > 0) {
    await db.insert(appSettings).values(missing).onConflictDoNothing();
  }
}
