# 🧩 3BLD Attempt Tracker

Eine TypeScript-Webapp mit **Scramble, Timer und DNF-Analyse in einem** – damit auf
dem Handy keine zweite App nötig ist. Jeder 3BLD-Versuch wird als Success oder DNF
erfasst, bei einem DNF die Fehlerursachen, und daraus entsteht eine gezielte
Übungsliste. Single-User, ohne Login.

Gebaut für ein konkretes Ziel: **1000 Attempts in einem Monat.**

## Datenmodell

Ein **Attempt** ist entweder Success oder DNF. Ein DNF kann beliebig viele
**Fehler** haben – das ist bewusst eine 1:n-Beziehung, damit alle realen Fälle
abbildbar sind:

- Fehler nur bei den Edges, nur bei den Corners oder bei beidem
- innerhalb einer Kategorie sowohl Memo- als auch Execution-Fehler
- mehrfach derselbe Fehlertyp (z.B. zwei Corner-Exec-Fehler in einem Solve)

Jeder Fehler besteht aus **Kategorie** (Edges/Corners) × **Phase** (Memo/Execution)
× **Grund** und kann einen **Kommentar** tragen – z.B. welcher Commutator konkret
schiefging. Zusätzlich lässt sich pro Solve eine allgemeine Notiz erfassen.

| Tabelle | Inhalt |
|---------|--------|
| `attempts` | ein Versuch: Success oder DNF, Zeit, Scramble, Zeitpunkt, optionale Notiz |
| `attempt_errors` | einzelner Fehler eines DNF (Kategorie, Phase, Grund, Kommentar) |
| `reasons` | frei erweiterbarer Katalog an Gründen je Phase, mit Shortcut |
| `app_settings` | Ziel (Anzahl Attempts, Zeitraum) |

Die Gründe sind **nicht fest verdrahtet**. Startwerte:

- **Memo:** Vergessen, Reihenfolge, Tracing
- **Execution:** Mismove, Commutator, LTCT, Buffer

Neue Gründe lassen sich jederzeit anlegen – unter `/settings` oder direkt im
DNF-Dialog über das **+** neben der jeweiligen Phase. Gelöschte Gründe verfälschen
die Historie nicht: der Name wird beim Erfassen mitgespeichert. Wer einen Grund
nur aus der Auswahl nehmen will, ohne die Statistik zu verlieren, **archiviert** ihn.

## Scramble und Timer

Der Tracker bringt beides selbst mit, damit auf dem Handy kein App-Wechsel mehr
nötig ist: oben steht der Scramble, darunter die Timer-Fläche.

1. Scramble ausführen (`↻ Neu` bzw. `N` erzeugt einen neuen).
2. Timer-Fläche gedrückt halten, bis sie grün wird, dann loslassen – der Timer
   läuft. Am Laptop macht die `Leertaste` dasselbe.
3. Während des Solves füllt der Timer den Bildschirm. Jede Berührung bzw. jede
   Taste stoppt ihn. Solange er läuft, hält ein Wake Lock das Display an.
4. Die gestoppte Zeit steht bereit – `SUCCESS` oder `DNF` wählen. Die Zeit und
   der Scramble werden am Versuch gespeichert, danach kommt automatisch der
   nächste Scramble.

Die Zeit ist optional: wer ohne Timer zählt, drückt einfach direkt `S` oder `D`.
Der Versuch wird dann ohne Zeit gespeichert.

Scrambles sind zufällige Zugfolgen (25 Züge, keine Wiederholung derselben Fläche,
keine dreifach besetzte Achse) plus zufällige Orientierung am Schluss, wie bei
BLD-Scrambles üblich. Das kommt ohne Solver-WASM aus, lädt sofort und funktioniert
offline – dafür sind es keine WCA-Random-State-Scrambles.

Auf dem Handy lässt sich die Seite über „Zum Homescreen hinzufügen" als App
installieren; sie startet dann ohne Browser-Leiste.

## Bedienung

Der Startbildschirm hat Scramble, Timer und genau zwei Ergebnis-Knöpfe.

| Taste | Aktion |
|-------|--------|
| `Leertaste` | Timer: halten, loslassen zum Starten, beliebige Taste stoppt |
| `S` | Success erfassen |
| `D` / `F` | DNF-Dialog öffnen |
| `N` | neuer Scramble |
| `Ctrl+Z` | letzten Versuch rückgängig machen (überall) |

Im DNF-Dialog ist immer eine Kategorie aktiv. Der Dialog **startet bei den Edges**
und springt **nach jedem erfassten Fehler automatisch zu den Corners** – das ist
die übliche Reihenfolge. Für einen zweiten Edges-Fehler mit `e` zurückwechseln.

| Taste | Aktion |
|-------|--------|
| `e` / `1` | zurück zu Edges |
| `c` / `2` | zu Corners |
| Buchstabe | Grund hinzufügen (`v` Vergessen, `k` Commutator, …) |
| mehrfach | denselben Grund mehrfach erfassen |
| `Tab` / `/` | Kommentarfeld des zuletzt erfassten Fehlers fokussieren |
| `⌫` | letzten Fehler wieder entfernen |
| `Enter` | DNF speichern (ohne Auswahl: DNF ohne Grund) |
| `Esc` | abbrechen |

Im Kommentarfeld:

| Taste | Aktion |
|-------|--------|
| `Enter` | DNF abschliessen und speichern |
| `e` / `c` | direkt weiter zu Edges bzw. Corners (verlässt das Feld) |
| `Tab` | zum nächsten Kommentar, zuletzt zur Notiz und wieder von vorn |
| `Esc` | Feld verlassen |

> **Achtung:** Weil `e` und `c` auch im Kommentarfeld als Kommando wirken, sind
> sie dort nur als **Grossbuchstabe** tippbar – also `EC` statt `ec`. Alle anderen
> Zeichen inklusive `Shift+E`/`Shift+C` gehen normal ins Feld.

Ein typischer DNF mit Edges-Memo- und Corners-Exec-Fehler ist damit
`d` `v` `k` `Enter` – vier Anschläge, da der Sprung zu den Corners automatisch
passiert. Per Maus geht es genauso: beide Kategorien stehen nebeneinander, ein
Klick auf einen Grund fügt ihn in seiner Spalte hinzu.

Die Tasten `e`, `c`, `1`, `2`, `Enter`, `Esc`, `Leertaste`, `⌫` und `/` sind
reserviert und können nicht von einem Grund-Shortcut überschrieben werden.

## Seiten

- **Tracker** (`/`) – Scramble, Timer und Erfassung plus Zielfortschritt, Zeiten
  (Best, Ø 12, Ø gesamt) und die letzten Versuche.
- **Statistiken** (`/stats`) – Zielverlauf gegen Soll-Tempo, Zeiten, Success-Rate pro Tag,
  Fehler-Matrix (Edges/Corners × Memo/Exec), Häufigkeit pro Grund, betroffene
  Kategorie pro DNF und die **Übungsliste**: alle Kommentare nach Grund gruppiert
  und nach Häufigkeit sortiert.
- **Einstellungen** (`/settings`) – Ziel, Gründe verwalten (anlegen, umbenennen,
  Shortcut setzen, sortieren, archivieren, löschen) und **Reset**.

### Solves zurücksetzen

Unter `/settings` → *Daten zurücksetzen*. Zur Sicherheit muss `RESET` eingetippt
werden. Gelöscht werden alle Versuche samt Fehlern und Kommentaren; Gründe und
Ziel bleiben erhalten.

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

Beim ersten Start legt die App die Standard-Gründe und ein Ziel von 1000 Attempts
über 30 Tage an. Beides ist unter `/settings` änderbar.

Zeiten werden nur über Successes gerechnet – ein DNF hat keine gültige Zeit.

### Datenbank (Neon)

1. Auf [neon.tech](https://neon.tech) ein Projekt anlegen.
2. Die **pooled** Connection-String als `DATABASE_URL` in `.env` setzen.
3. `npm run db:push` erstellt die Tabellen.

```bash
npm run db:generate   # SQL-Migrationen aus dem Schema generieren
npm run db:prepare    # entfernt die Tabellen des alten Datenmodells
npm run db:push       # Schema direkt in die DB pushen
npm run db:studio     # Drizzle Studio (DB-Browser)
```

> `db:prepare` läuft auch als erster Schritt von `npm run build`. Es löscht die
> Tabellen der Vorgängerversion (`dnf_entries`, `sub_categories`,
> `macro_categories`). Ohne diesen Schritt kann `drizzle-kit push` nicht
> entscheiden, ob eine alte Tabelle gelöscht oder umbenannt wurde, und fragt
> interaktiv nach – was einen CI-Build blockieren würde. Der Schritt ist
> idempotent.

## Deployment auf Vercel

1. Repo auf Vercel importieren.
2. Environment-Variable `DATABASE_URL` setzen (Neon pooled connection string),
   für alle Environments.
3. Deployen – `npm run build` bringt das Schema selbst auf Stand.

Optional: `APP_TIMEZONE` setzt die Zeitzone für Tagesgrenzen (Default
`Europe/Zurich`).
