"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Stats } from "@/db/queries";
import type { PieceType, Phase } from "@/db/schema";

const CLR_EDGE = "#00d4ff";
const CLR_CORNER = "#a855f7";
const CLR_SUCCESS = "#00ff94";
const CLR_DNF = "#ff2d78";
const CLR_GOAL = "#ffd60a";

const TOOLTIP_STYLE = {
  background: "#0b0f1a",
  border: "1px solid #1a2540",
  borderRadius: 10,
  color: "#ddeeff",
  fontSize: 12,
};
const GRID_COLOR = "#1a2540";
const AXIS_COLOR = "#4a6080";

const PIECE_LABEL: Record<PieceType, string> = { edges: "Edges", corners: "Corners" };
const PHASE_LABEL: Record<Phase, string> = { memo: "Memo", exec: "Execution" };

function shortDay(iso: string) {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

export default function StatsView({ stats }: { stats: Stats }) {
  const { goal, totals, scope, matrix, byPhase, byPiece, reasonStats, comments, daily, recent } = stats;
  const [phaseFilter, setPhaseFilter] = useState<Phase | "all">("all");

  const dailyData = daily.map((d, i) => ({
    day: shortDay(d.day),
    Success: d.success,
    DNF: d.dnf,
    Kumuliert: d.cumulative,
    Ziel: Math.round((goal.target / goal.daysTotal) * (i + 1)),
    rate: d.successRate,
  }));

  const filteredReasons =
    phaseFilter === "all" ? reasonStats : reasonStats.filter((r) => r.phase === phaseFilter);

  const reasonData = filteredReasons.map((r) => ({
    name: `${r.name} (${PHASE_LABEL[r.phase].slice(0, 4)})`,
    Edges: r.edges,
    Corners: r.corners,
  }));

  const scopeData = [
    { name: "Nur Edges", value: scope.edgesOnly, color: CLR_EDGE },
    { name: "Nur Corners", value: scope.cornersOnly, color: CLR_CORNER },
    { name: "Beides", value: scope.both, color: CLR_DNF },
    { name: "Ohne Grund", value: scope.unspecified, color: AXIS_COLOR },
  ].filter((d) => d.value > 0);

  const topReason = reasonStats[0];
  const commentsByReason = groupComments(comments);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Statistiken <span className="text-gradient">Analyse</span>
        </h1>
        <p className="text-sm text-muted">
          {totals.attempts} Versuche · {totals.dnf} DNFs · ø {stats.errorsPerDnf} Fehler pro DNF
        </p>
      </div>

      {/* Ziel */}
      <div className="rounded-2xl border border-border/70 bg-surface/70 p-4 backdrop-blur sm:p-5">
        <div className="mb-4 text-xs font-bold uppercase tracking-widest text-muted">
          Ziel: {goal.target} Attempts ({goal.start} – {goal.end})
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-gradient text-3xl font-black tabular-nums sm:text-4xl">{goal.done}</span>
            <span className="text-xl font-bold text-muted">/ {goal.target}</span>
          </div>
          <span className="text-sm text-muted">
            Tag <span className="font-bold text-white tabular-nums">{goal.dayIndex}</span> von{" "}
            {goal.daysTotal}
          </span>
          <span className="text-sm text-muted">
            Noch <span className="font-bold text-white tabular-nums">{goal.remaining}</span> übrig
          </span>
          <span className="text-sm text-muted">
            <span className="font-bold text-white tabular-nums">{goal.perDayNeeded}</span> pro Tag
            nötig
          </span>
          <span
            className={`text-sm font-bold ${goal.done >= goal.expectedByNow ? "text-accent-2" : "text-yellow"}`}
          >
            {goal.done >= goal.expectedByNow ? "▲" : "▼"} {Math.abs(goal.done - goal.expectedByNow)}{" "}
            vs. Plan ({goal.expectedByNow})
          </span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-purple"
            style={{ width: `${goal.percent}%` }}
          />
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GlowCard label="Attempts" value={totals.attempts} color="neutral" />
        <GlowCard label="Success-Rate" value={`${totals.successRate}%`} sub={`${totals.success} Success`} color="green" />
        <GlowCard label="DNFs" value={totals.dnf} sub={`${100 - totals.successRate}%`} color="pink" />
        <GlowCard
          label="Häufigster Fehler"
          value={topReason?.name ?? "–"}
          sub={topReason ? `${topReason.total}× · in ${topReason.shareOfDnfs}% der DNFs` : ""}
          color="purple"
        />
      </div>

      {/* Verlauf */}
      <ChartCard title="Verlauf pro Tag — Success vs. DNF, kumuliert gegen Ziel">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={dailyData} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="day" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
            <YAxis yAxisId="left" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 11 }} allowDecimals={false} />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={AXIS_COLOR}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: AXIS_COLOR }} />
            <Bar yAxisId="left" dataKey="Success" stackId="a" fill={CLR_SUCCESS} />
            <Bar yAxisId="left" dataKey="DNF" stackId="a" fill={CLR_DNF} radius={[3, 3, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Kumuliert"
              stroke={CLR_EDGE}
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Ziel"
              stroke={CLR_GOAL}
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Wo passiert es? */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Fehler-Matrix">
          <div className="grid grid-cols-2 gap-2">
            {matrix.map((cell) => {
              const max = Math.max(...matrix.map((m) => m.count), 1);
              const intensity = cell.count / max;
              const color = cell.pieceType === "edges" ? CLR_EDGE : CLR_CORNER;
              return (
                <div
                  key={`${cell.pieceType}-${cell.phase}`}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: `${color}55`,
                    background: `${color}${Math.round(intensity * 30 + 8)
                      .toString(16)
                      .padStart(2, "0")}`,
                  }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
                    {PIECE_LABEL[cell.pieceType]} · {PHASE_LABEL[cell.phase]}
                  </div>
                  <div className="mt-1 text-2xl font-black tabular-nums">{cell.count}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted">
            <div>
              Memo <span className="font-bold text-white">{byPhase.memo}</span> · Exec{" "}
              <span className="font-bold text-white">{byPhase.exec}</span>
            </div>
            <div className="text-right">
              Edges <span className="font-bold" style={{ color: CLR_EDGE }}>{byPiece.edges}</span> ·
              Corners <span className="font-bold" style={{ color: CLR_CORNER }}>{byPiece.corners}</span>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Betroffene Kategorie pro DNF">
          {scopeData.length === 0 ? (
            <p className="text-sm text-muted">Noch keine Gründe erfasst.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={scopeData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                <XAxis type="number" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={92}
                  stroke={AXIS_COLOR}
                  tick={{ fill: "#ddeeff", fontSize: 12 }}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="value" name="DNFs" radius={[0, 4, 4, 0]}>
                  {scopeData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Gründe */}
      <ChartCard
        title="Häufigkeit pro Grund"
        action={
          <div className="flex gap-1">
            {(["all", "memo", "exec"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPhaseFilter(p)}
                className={`flex h-9 items-center rounded-lg border px-3 text-[11px] font-bold uppercase tracking-wider transition ${
                  phaseFilter === p
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border text-muted hover:text-white"
                }`}
              >
                {p === "all" ? "Alle" : PHASE_LABEL[p]}
              </button>
            ))}
          </div>
        }
      >
        {reasonData.length === 0 ? (
          <p className="text-sm text-muted">Keine Fehler in dieser Auswahl.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, reasonData.length * 44)}>
            <BarChart data={reasonData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={165}
                stroke={AXIS_COLOR}
                tick={{ fill: "#ddeeff", fontSize: 12 }}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: AXIS_COLOR }} />
              <Bar dataKey="Edges" stackId="a" fill={CLR_EDGE} />
              <Bar dataKey="Corners" stackId="a" fill={CLR_CORNER} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Übungsliste aus den Kommentaren */}
      <ChartCard title="Übungsliste — die häufigsten Kommentare">
        {comments.length === 0 ? (
          <p className="text-sm text-muted">
            Noch keine Kommentare erfasst. Notiere beim DNF z.B. welcher Commutator schiefging –
            hier entsteht daraus automatisch deine Übungsliste.
          </p>
        ) : (
          <div className="space-y-4">
            {commentsByReason.map(([reasonName, items]) => (
              <div key={reasonName}>
                <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">
                  {reasonName}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((c) => (
                    <span
                      key={c.comment}
                      className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm"
                      title={`${c.edges}× Edges · ${c.corners}× Corners`}
                    >
                      {c.comment}
                      <span className="ml-1.5 font-bold text-accent">{c.count}×</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Log */}
      <ChartCard title="Letzte Versuche">
        <ul className="divide-y divide-border/50">
          {recent.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-2.5 text-sm">
              <span
                className={`mt-1 rounded-md border px-1.5 py-0.5 text-[10px] font-black ${
                  a.isDnf
                    ? "border-danger/40 bg-danger/10 text-danger"
                    : "border-accent-2/40 bg-accent-2/10 text-accent-2"
                }`}
              >
                {a.isDnf ? "DNF" : "OK"}
              </span>
              <div className="flex-1">
                {a.errors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {a.errors.map((e, i) => (
                      <span
                        key={i}
                        className="rounded-md border px-1.5 py-0.5 text-[11px]"
                        style={{
                          borderColor: `${e.pieceType === "edges" ? CLR_EDGE : CLR_CORNER}55`,
                          color: e.pieceType === "edges" ? CLR_EDGE : CLR_CORNER,
                        }}
                      >
                        {PIECE_LABEL[e.pieceType]} · {PHASE_LABEL[e.phase]} · {e.reasonName}
                        {e.comment ? <span className="opacity-70"> „{e.comment}“</span> : null}
                      </span>
                    ))}
                  </div>
                )}
                {a.note && <div className="mt-1 text-xs text-muted">{a.note}</div>}
              </div>
              <time className="shrink-0 font-mono text-[11px] text-muted">
                {new Date(a.occurredAt).toLocaleString("de-CH", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          ))}
        </ul>
      </ChartCard>
    </div>
  );
}

function groupComments(comments: Stats["comments"]): [string, Stats["comments"]][] {
  const map = new Map<string, Stats["comments"]>();
  for (const c of comments) {
    const list = map.get(c.reasonName) ?? [];
    list.push(c);
    map.set(c.reasonName, list);
  }
  return [...map.entries()].sort(
    (a, b) =>
      b[1].reduce((s, c) => s + c.count, 0) - a[1].reduce((s, c) => s + c.count, 0)
  );
}

function ChartCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface/70 p-3 backdrop-blur sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-widest text-muted">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function GlowCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: "blue" | "green" | "purple" | "pink" | "neutral";
}) {
  const styles = {
    blue: { border: "border-accent/30", text: "text-accent", glow: "shadow-neon-blue-sm" },
    green: { border: "border-accent-2/30", text: "text-accent-2", glow: "shadow-neon-green-sm" },
    purple: { border: "border-purple/30", text: "text-purple", glow: "" },
    pink: { border: "border-danger/30", text: "text-danger", glow: "" },
    neutral: { border: "border-border/70", text: "text-white", glow: "" },
  }[color];

  return (
    <div className={`rounded-2xl border bg-surface/70 p-3 backdrop-blur sm:p-4 ${styles.border} ${styles.glow}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted sm:text-xs">{label}</div>
      <div className={`mt-1 truncate text-2xl font-black ${styles.text}`} title={String(value)}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
