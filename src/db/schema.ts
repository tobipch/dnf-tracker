import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const macroCategories = pgTable("macro_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Single keyboard key used as shortcut, e.g. "1", "q". Nullable = no shortcut.
  shortcut: text("shortcut"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subCategories = pgTable(
  "sub_categories",
  {
    id: serial("id").primaryKey(),
    macroId: integer("macro_id")
      .notNull()
      .references(() => macroCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    shortcut: text("shortcut"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    macroIdx: index("sub_macro_idx").on(t.macroId),
  })
);

export const dnfEntries = pgTable(
  "dnf_entries",
  {
    id: serial("id").primaryKey(),
    macroId: integer("macro_id")
      .notNull()
      .references(() => macroCategories.id, { onDelete: "cascade" }),
    // Nullable: macro categories without sub categories are booked at macro level.
    subId: integer("sub_id").references(() => subCategories.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    occurredIdx: index("dnf_occurred_idx").on(t.occurredAt),
    macroIdx: index("dnf_macro_idx").on(t.macroId),
  })
);

export type MacroCategory = typeof macroCategories.$inferSelect;
export type SubCategory = typeof subCategories.$inferSelect;
export type DnfEntry = typeof dnfEntries.$inferSelect;
