import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

/** Welches Teil-Set war betroffen. */
export const pieceTypeEnum = pgEnum("piece_type", ["edges", "corners"]);

/** In welcher Phase des Solves ist der Fehler passiert. */
export const phaseEnum = pgEnum("phase", ["memo", "exec"]);

/**
 * Frei erweiterbarer Katalog an Fehlergründen.
 * Ein Grund gehört immer zu genau einer Phase (Memo oder Execution) und gilt
 * für Edges wie Corners gleichermassen.
 */
export const reasons = pgTable(
  "reasons",
  {
    id: serial("id").primaryKey(),
    phase: phaseEnum("phase").notNull(),
    name: text("name").notNull(),
    /** Einzelner Tastatur-Shortcut, z.B. "m". Muss global eindeutig sein. */
    shortcut: text("shortcut"),
    position: integer("position").notNull().default(0),
    /** Archiviert = nicht mehr auswählbar, historische Daten bleiben erhalten. */
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    phaseIdx: index("reasons_phase_idx").on(t.phase),
  })
);

/**
 * Ein Versuch (Solve). Entweder Success oder DNF.
 * Das ist die Basis für die 1000-Attempts-Zählung.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: serial("id").primaryKey(),
    isDnf: boolean("is_dnf").notNull(),
    /** Gestoppte Zeit in Millisekunden; null, wenn ohne Timer erfasst. */
    timeMs: integer("time_ms"),
    /** Scramble, an dem der Versuch gemacht wurde. */
    scramble: text("scramble"),
    /** Optionale Notiz zum gesamten Solve. */
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    occurredIdx: index("attempts_occurred_idx").on(t.occurredAt),
  })
);

/**
 * Einzelner Fehler innerhalb eines DNF.
 *
 * Bewusst als eigene Tabelle (1:n), damit pro Solve beliebig viele Fehler
 * erfasst werden können: Edges + Corners gleichzeitig, Memo + Exec innerhalb
 * derselben Kategorie, oder auch zweimal derselbe Fehlertyp.
 */
export const attemptErrors = pgTable(
  "attempt_errors",
  {
    id: serial("id").primaryKey(),
    attemptId: integer("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    pieceType: pieceTypeEnum("piece_type").notNull(),
    phase: phaseEnum("phase").notNull(),
    reasonId: integer("reason_id").references(() => reasons.id, { onDelete: "set null" }),
    /** Name-Snapshot, damit die Historie lesbar bleibt, wenn ein Grund gelöscht wird. */
    reasonName: text("reason_name").notNull(),
    /** Freitext, z.B. welcher Commutator konkret schiefging. */
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    attemptIdx: index("attempt_errors_attempt_idx").on(t.attemptId),
    reasonIdx: index("attempt_errors_reason_idx").on(t.reasonId),
  })
);

/** Kleiner Key-Value-Store für Ziel-Einstellungen. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Reason = typeof reasons.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type AttemptError = typeof attemptErrors.$inferSelect;

export type PieceType = "edges" | "corners";
export type Phase = "memo" | "exec";
