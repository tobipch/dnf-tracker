/**
 * Entfernt die Tabellen des alten Datenmodells (reine DNF-Erfassung mit
 * Makro-/Unterkategorien). Das neue Modell arbeitet mit attempts /
 * attempt_errors / reasons.
 *
 * Läuft vor `drizzle-kit push`: sonst kann drizzle-kit nicht entscheiden, ob
 * eine alte Tabelle gelöscht oder umbenannt wurde, und fragt interaktiv nach –
 * was einen CI-/Vercel-Build blockieren würde.
 *
 * Idempotent: nach dem ersten Durchlauf passiert nichts mehr.
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ist nicht gesetzt.");
  process.exit(1);
}

const sql = neon(url);

// Reihenfolge beachtet die Fremdschlüssel; CASCADE räumt den Rest ab.
await sql`DROP TABLE IF EXISTS dnf_entries CASCADE`;
await sql`DROP TABLE IF EXISTS sub_categories CASCADE`;
await sql`DROP TABLE IF EXISTS macro_categories CASCADE`;

console.log("Legacy-Tabellen entfernt (falls vorhanden).");
