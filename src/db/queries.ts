import { db } from "./index";
import { reasons, attempts, attemptErrors, appSettings } from "./schema";
import { asc, desc, inArray } from "drizzle-orm";
import type { Reason, PieceType, Phase } from "./schema";
import { SETTING_KEYS, DEFAULT_GOAL_TARGET, DEFAULT_GOAL_DAYS } from "./seed";

/** Alle Tages-Grenzen werden in dieser Zeitzone berechnet. */
export const TIME_ZONE = process.env.APP_TIMEZONE || "Europe/Zurich";

const dayFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Lokaler Tagesschlüssel im Format YYYY-MM-DD. */
export function dayKey(d: Date): string {
  return dayFormatter.format(d);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/* ------------------------------- Gründe ---------------------------------- */

export type ReasonsByPhase = { memo: Reason[]; exec: Reason[] };

export async function getReasons(includeArchived = false): Promise<Reason[]> {
  const rows = await db
    .select()
    .from(reasons)
    .orderBy(asc(reasons.position), asc(reasons.id));
  return includeArchived ? rows : rows.filter((r) => !r.archived);
}

export function groupReasons(rows: Reason[]): ReasonsByPhase {
  return {
    memo: rows.filter((r) => r.phase === "memo"),
    exec: rows.filter((r) => r.phase === "exec"),
  };
}

/* --------------------------------- Ziel ---------------------------------- */

export type Goal = {
  target: number;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
};

export async function getGoal(): Promise<Goal> {
  const rows = await db.select().from(appSettings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const today = dayKey(new Date());
  const start = map.get(SETTING_KEYS.goalStart) ?? today;
  return {
    target: Number(map.get(SETTING_KEYS.goalTarget) ?? DEFAULT_GOAL_TARGET) || DEFAULT_GOAL_TARGET,
    start,
    end: map.get(SETTING_KEYS.goalEnd) ?? addDays(start, DEFAULT_GOAL_DAYS),
  };
}

export type GoalProgress = Goal & {
  done: number;
  remaining: number;
  percent: number;
  daysTotal: number;
  daysLeft: number;       // inkl. heute, 0 wenn abgelaufen
  dayIndex: number;       // wievielter Tag des Zeitraums (1-basiert)
  perDayNeeded: number;   // ab heute nötig, um das Ziel zu erreichen
  expectedByNow: number;  // Soll-Stand bei gleichmässigem Tempo
  todayCount: number;
};

function computeGoalProgress(goal: Goal, dayCounts: Map<string, number>): GoalProgress {
  const today = dayKey(new Date());
  let done = 0;
  for (const [day, count] of dayCounts) {
    if (day >= goal.start && day <= goal.end) done += count;
  }

  const daysTotal = Math.max(1, daysBetween(goal.start, goal.end) + 1);
  const rawIndex = daysBetween(goal.start, today) + 1;
  const dayIndex = Math.min(Math.max(rawIndex, 1), daysTotal);
  const daysLeft = Math.max(0, daysBetween(today, goal.end) + 1);
  const remaining = Math.max(0, goal.target - done);

  return {
    ...goal,
    done,
    remaining,
    percent: goal.target > 0 ? Math.min(100, Math.round((done / goal.target) * 1000) / 10) : 0,
    daysTotal,
    daysLeft,
    dayIndex,
    perDayNeeded: daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining,
    expectedByNow: Math.round((goal.target / daysTotal) * dayIndex),
    todayCount: dayCounts.get(today) ?? 0,
  };
}

/* ------------------------------- Tracker --------------------------------- */

export type RecentAttempt = {
  id: number;
  occurredAt: string;
  isDnf: boolean;
  timeMs: number | null;
  scramble: string | null;
  note: string | null;
  errors: { pieceType: PieceType; phase: Phase; reasonName: string; comment: string | null }[];
};

/** Zeiten werden nur über erfolgreiche Solves gerechnet – ein DNF hat keine gültige Zeit. */
export type TimeStats = {
  best: number | null;
  average: number | null;
  /** Schnitt der letzten 12 Successes, wie ein Ao12 ohne Streichresultate. */
  recentAverage: number | null;
  timed: number;
};

export type TrackerData = {
  reasons: ReasonsByPhase;
  goal: GoalProgress;
  totals: { attempts: number; success: number; dnf: number; successRate: number };
  today: { attempts: number; success: number; dnf: number };
  times: TimeStats;
  recent: RecentAttempt[];
};

/** Erwartet Zeiten in absteigender Reihenfolge (neueste zuerst). */
function computeTimeStats(successTimes: number[]): TimeStats {
  if (successTimes.length === 0) {
    return { best: null, average: null, recentAverage: null, timed: 0 };
  }
  const sum = successTimes.reduce((a, b) => a + b, 0);
  const last12 = successTimes.slice(0, 12);
  return {
    best: Math.min(...successTimes),
    average: Math.round(sum / successTimes.length),
    recentAverage: Math.round(last12.reduce((a, b) => a + b, 0) / last12.length),
    timed: successTimes.length,
  };
}

export async function getTrackerData(): Promise<TrackerData> {
  const [reasonRows, goal, attemptRows] = await Promise.all([
    getReasons(),
    getGoal(),
    db
      .select({
        id: attempts.id,
        isDnf: attempts.isDnf,
        timeMs: attempts.timeMs,
        occurredAt: attempts.occurredAt,
      })
      .from(attempts)
      .orderBy(desc(attempts.occurredAt), desc(attempts.id)),
  ]);

  const today = dayKey(new Date());
  const dayCounts = new Map<string, number>();
  let success = 0;
  let dnf = 0;
  let todaySuccess = 0;
  let todayDnf = 0;

  const successTimes: number[] = [];

  for (const a of attemptRows) {
    const key = dayKey(new Date(a.occurredAt));
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    if (a.isDnf) dnf++;
    else {
      success++;
      if (a.timeMs !== null) successTimes.push(a.timeMs);
    }
    if (key === today) {
      if (a.isDnf) todayDnf++;
      else todaySuccess++;
    }
  }

  const recentIds = attemptRows.slice(0, 12).map((a) => a.id);
  const recent = await loadAttemptsWithErrors(recentIds);

  const total = attemptRows.length;

  return {
    reasons: groupReasons(reasonRows),
    goal: computeGoalProgress(goal, dayCounts),
    totals: {
      attempts: total,
      success,
      dnf,
      successRate: total > 0 ? Math.round((success / total) * 1000) / 10 : 0,
    },
    today: { attempts: todaySuccess + todayDnf, success: todaySuccess, dnf: todayDnf },
    times: computeTimeStats(successTimes),
    recent,
  };
}

async function loadAttemptsWithErrors(ids: number[]): Promise<RecentAttempt[]> {
  if (ids.length === 0) return [];
  const [rows, errs] = await Promise.all([
    db.select().from(attempts).where(inArray(attempts.id, ids)),
    db.select().from(attemptErrors).where(inArray(attemptErrors.attemptId, ids)),
  ]);

  const byAttempt = new Map<number, RecentAttempt["errors"]>();
  for (const e of errs) {
    const list = byAttempt.get(e.attemptId) ?? [];
    list.push({
      pieceType: e.pieceType as PieceType,
      phase: e.phase as Phase,
      reasonName: e.reasonName,
      comment: e.comment,
    });
    byAttempt.set(e.attemptId, list);
  }

  const order = new Map(ids.map((id, i) => [id, i]));
  return rows
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((a) => ({
      id: a.id,
      occurredAt: new Date(a.occurredAt).toISOString(),
      isDnf: a.isDnf,
      timeMs: a.timeMs,
      scramble: a.scramble,
      note: a.note,
      errors: byAttempt.get(a.id) ?? [],
    }));
}

/* ----------------------------- Statistiken ------------------------------- */

export type ReasonStat = {
  name: string;
  phase: Phase;
  edges: number;
  corners: number;
  total: number;
  /** Anteil aller DNFs, in denen dieser Grund mindestens einmal vorkam (%). */
  shareOfDnfs: number;
};

export type CommentStat = {
  reasonName: string;
  phase: Phase;
  comment: string;
  count: number;
  edges: number;
  corners: number;
};

export type DayBucket = {
  day: string;
  attempts: number;
  success: number;
  dnf: number;
  successRate: number;
  cumulative: number;
};

export type Stats = {
  goal: GoalProgress;
  totals: { attempts: number; success: number; dnf: number; successRate: number };
  times: TimeStats;
  /** Nur Edges / nur Corners / beides / kein Grund erfasst – pro DNF. */
  scope: { edgesOnly: number; cornersOnly: number; both: number; unspecified: number };
  matrix: { pieceType: PieceType; phase: Phase; count: number }[];
  byPhase: { memo: number; exec: number };
  byPiece: { edges: number; corners: number };
  reasonStats: ReasonStat[];
  comments: CommentStat[];
  daily: DayBucket[];
  recent: RecentAttempt[];
  errorsPerDnf: number;
};

export async function getStats(): Promise<Stats> {
  const [attemptRows, errorRows, goal] = await Promise.all([
    db
      .select()
      .from(attempts)
      .orderBy(desc(attempts.occurredAt), desc(attempts.id)),
    db.select().from(attemptErrors).orderBy(asc(attemptErrors.id)),
    getGoal(),
  ]);

  const errorsByAttempt = new Map<number, typeof errorRows>();
  for (const e of errorRows) {
    const list = errorsByAttempt.get(e.attemptId) ?? [];
    list.push(e);
    errorsByAttempt.set(e.attemptId, list);
  }

  const dayCounts = new Map<string, number>();
  const dayBuckets = new Map<string, { attempts: number; success: number; dnf: number }>();

  let success = 0;
  let dnf = 0;
  const successTimes: number[] = [];
  const scope = { edgesOnly: 0, cornersOnly: 0, both: 0, unspecified: 0 };

  for (const a of attemptRows) {
    const key = dayKey(new Date(a.occurredAt));
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    const bucket = dayBuckets.get(key) ?? { attempts: 0, success: 0, dnf: 0 };
    bucket.attempts++;
    if (a.isDnf) {
      bucket.dnf++;
      dnf++;
      const errs = errorsByAttempt.get(a.id) ?? [];
      const hasEdges = errs.some((e) => e.pieceType === "edges");
      const hasCorners = errs.some((e) => e.pieceType === "corners");
      if (hasEdges && hasCorners) scope.both++;
      else if (hasEdges) scope.edgesOnly++;
      else if (hasCorners) scope.cornersOnly++;
      else scope.unspecified++;
    } else {
      bucket.success++;
      success++;
      if (a.timeMs !== null) successTimes.push(a.timeMs);
    }
    dayBuckets.set(key, bucket);
  }

  // Fehler-Aggregationen
  const matrixMap = new Map<string, number>();
  const byPhase = { memo: 0, exec: 0 };
  const byPiece = { edges: 0, corners: 0 };
  const reasonMap = new Map<string, ReasonStat>();
  const reasonDnfIds = new Map<string, Set<number>>();
  const commentMap = new Map<string, CommentStat>();

  for (const e of errorRows) {
    const piece = e.pieceType as PieceType;
    const phase = e.phase as Phase;

    matrixMap.set(`${piece}|${phase}`, (matrixMap.get(`${piece}|${phase}`) ?? 0) + 1);
    byPhase[phase]++;
    byPiece[piece]++;

    const key = `${phase}|${e.reasonName}`;
    const stat = reasonMap.get(key) ?? {
      name: e.reasonName,
      phase,
      edges: 0,
      corners: 0,
      total: 0,
      shareOfDnfs: 0,
    };
    stat.total++;
    if (piece === "edges") stat.edges++;
    else stat.corners++;
    reasonMap.set(key, stat);

    const ids = reasonDnfIds.get(key) ?? new Set<number>();
    ids.add(e.attemptId);
    reasonDnfIds.set(key, ids);

    const comment = (e.comment ?? "").trim();
    if (comment) {
      const cKey = `${key}|${comment.toLowerCase()}`;
      const c = commentMap.get(cKey) ?? {
        reasonName: e.reasonName,
        phase,
        comment,
        count: 0,
        edges: 0,
        corners: 0,
      };
      c.count++;
      if (piece === "edges") c.edges++;
      else c.corners++;
      commentMap.set(cKey, c);
    }
  }

  const reasonStats = [...reasonMap.entries()]
    .map(([key, stat]) => ({
      ...stat,
      shareOfDnfs:
        dnf > 0 ? Math.round(((reasonDnfIds.get(key)?.size ?? 0) / dnf) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const comments = [...commentMap.values()].sort(
    (a, b) => b.count - a.count || a.comment.localeCompare(b.comment)
  );

  const matrix: Stats["matrix"] = [];
  for (const piece of ["edges", "corners"] as PieceType[]) {
    for (const phase of ["memo", "exec"] as Phase[]) {
      matrix.push({ pieceType: piece, phase, count: matrixMap.get(`${piece}|${phase}`) ?? 0 });
    }
  }

  // Lückenlose Tagesreihe vom ersten Attempt (bzw. Zielstart) bis heute.
  const today = dayKey(new Date());
  const sortedDays = [...dayBuckets.keys()].sort();
  const daily: DayBucket[] = [];
  if (sortedDays.length > 0) {
    const first = sortedDays[0] < goal.start ? sortedDays[0] : goal.start;
    const last = today > sortedDays[sortedDays.length - 1] ? today : sortedDays[sortedDays.length - 1];
    let cumulative = 0;
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const b = dayBuckets.get(d) ?? { attempts: 0, success: 0, dnf: 0 };
      cumulative += b.attempts;
      daily.push({
        day: d,
        ...b,
        successRate: b.attempts > 0 ? Math.round((b.success / b.attempts) * 1000) / 10 : 0,
        cumulative,
      });
    }
  }

  const recent = await loadAttemptsWithErrors(attemptRows.slice(0, 40).map((a) => a.id));
  const total = attemptRows.length;

  return {
    goal: computeGoalProgress(goal, dayCounts),
    totals: {
      attempts: total,
      success,
      dnf,
      successRate: total > 0 ? Math.round((success / total) * 1000) / 10 : 0,
    },
    times: computeTimeStats(successTimes),
    scope,
    matrix,
    byPhase,
    byPiece,
    reasonStats,
    comments,
    daily,
    recent,
    errorsPerDnf: dnf > 0 ? Math.round((errorRows.length / dnf) * 100) / 100 : 0,
  };
}

/** Nur für die Settings-Seite: wie viele Datensätze würde ein Reset löschen. */
export async function getDataCounts(): Promise<{ attempts: number; errors: number }> {
  const [a, e] = await Promise.all([
    db.select({ id: attempts.id }).from(attempts),
    db.select({ id: attemptErrors.id }).from(attemptErrors),
  ]);
  return { attempts: a.length, errors: e.length };
}

export type { Reason };
