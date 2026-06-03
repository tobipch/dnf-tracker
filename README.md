# 🧩 3BLD DNF Tracker

Eine kleine TypeScript-Webapp, um die Gründe für deine 3BLD-DNFs zu erfassen und
statistisch auszuwerten. Single-User, ohne Login.

- **Tracker** (`/`): Zweistufige Erfassung — zuerst Makro-Kategorie, dann (falls
  vorhanden) Unterkategorie. Bedienbar per Maus oder Tastatur-Shortcuts.
- **Statistiken** (`/stats`): Häufigkeit pro Grund, Verlauf über Zeit, relative
  Häufigkeit (% pro Woche) je Grund und ein Log der letzten DNFs.
- **Kategorien** (`/settings`): Makro- und Unterkategorien sowie deren Shortcuts
  frei definieren, umsortieren und löschen.

## Bedienung (Tracker)

| Taste | Aktion |
|-------|--------|
| `1`–`9`, `0` | Makro-Kategorie wählen (bzw. den konfigurierten Shortcut) |
| dann `1`–`9` | Unterkategorie wählen (falls die Makro-Kategorie welche hat) |
| `Esc` | Zurück zur Kategorie-Übersicht |
| `U` | Letzten DNF rückgängig machen |

Hat eine Makro-Kategorie **keine** Unterkategorien, wird der DNF sofort gespeichert.
Hat sie welche, **muss** eine Unterkategorie gewählt werden.

## Tech-Stack

- **Next.js 14** (App Router, Server Actions) + TypeScript
- **Drizzle ORM** + **NeonDB** (Serverless PostgreSQL)
- **Tailwind CSS** + **Recharts**

## Lokales Setup

```bash
npm install
cp .env.example .env        # DATABASE_URL eintragen (Neon connection string)
npm run db:push             # Schema in die Datenbank pushen
npm run dev                 # http://localhost:3000
```

### Datenbank (Neon)

1. Auf [neon.tech](https://neon.tech) ein Projekt anlegen.
2. Die **pooled** Connection-String kopieren und als `DATABASE_URL` in `.env` setzen.
3. `npm run db:push` erstellt die Tabellen (`macro_categories`, `sub_categories`, `dnf_entries`).

Nützliche DB-Befehle:

```bash
npm run db:generate   # SQL-Migrationen aus dem Schema generieren
npm run db:push       # Schema direkt in die DB pushen (für schnelle Iteration)
npm run db:studio     # Drizzle Studio (DB-Browser)
```

## Deployment auf Vercel

1. Repo auf Vercel importieren.
2. Environment-Variable `DATABASE_URL` setzen (Neon pooled connection string),
   für alle Environments (Production/Preview).
3. Deployen. Beim ersten Mal einmalig `npm run db:push` lokal gegen die
   Produktions-DB ausführen (oder die Migrationen über CI anwenden).

> Hinweis: Da Neon über `@neondatabase/serverless` (HTTP) angebunden ist, läuft
> die App problemlos auf Vercels Serverless/Edge-Infrastruktur.
