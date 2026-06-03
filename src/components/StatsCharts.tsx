"use client";

import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import type { Stats } from "@/db/queries";

const CLR_EDGE   = "#00d4ff";
const CLR_CORNER = "#00ff94";
const PALETTE    = ["#00d4ff","#00ff94","#a855f7","#ffd60a","#ff2d78","#ff9500","#b3ff00","#ff5af0","#00ffcc","#c0c4cc"];

function colorOf(name: string, names: string[]) {
  return PALETTE[names.indexOf(name) % PALETTE.length];
}

const TOOLTIP_STYLE = {
  background: "#0b0f1a",
  border: "1px solid #1a2540",
  borderRadius: 10,
  color: "#ddeeff",
  fontSize: 12,
};

const GRID_COLOR = "#1a2540";
const AXIS_COLOR = "#4a6080";

function fmtDate(d: Date) {
  return new Date(d).toLocaleString("de-CH", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function StatsCharts({ stats }: { stats: Stats }) {
  const { totalDnfs, totalEdges, totalCorners, perMacro, perSub, weekly, macroNames, recent } = stats;
  const edgePct   = totalDnfs > 0 ? Math.round((totalEdges   / totalDnfs) * 100) : 0;
  const cornerPct = totalDnfs > 0 ? Math.round((totalCorners / totalDnfs) * 100) : 0;

  const weeklyTotalData = weekly.map((w) => ({ week: w.week, Edges: w.edges, Corners: w.corners }));
  const shareData       = weekly.map((w) => ({ week: w.week, ...w.shares }));
  const pieceBar        = [
    { name: "Edges",   count: totalEdges },
    { name: "Corners", count: totalCorners },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          Statistiken <span className="text-gradient">Analyse</span>
        </h1>
        <p className="text-sm text-muted">Alle deine erfassten DNF-Fehler im Überblick.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GlowCard label="Fehler gesamt" value={totalDnfs} color="neutral" />
        <GlowCard label="Edges" value={totalEdges} sub={`${edgePct}%`} color="blue" />
        <GlowCard label="Corners" value={totalCorners} sub={`${cornerPct}%`} color="green" />
        <GlowCard label="Häufigster" value={perMacro[0]?.name ?? "–"} sub={perMacro[0] ? `${perMacro[0].count}×` : ""} color="purple" />
      </div>

      {/* Frequency per macro stacked E/C */}
      <ChartCard title="Häufigkeit pro Grund">
        <ResponsiveContainer width="100%" height={Math.max(170, perMacro.length * 46)}>
          <BarChart
            data={perMacro.map((m) => ({ name: m.name, Edges: m.edges, Corners: m.corners }))}
            layout="vertical"
            margin={{ left: 8, right: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
            <XAxis type="number" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={145} stroke={AXIS_COLOR} tick={{ fill: "#ddeeff", fontSize: 12 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#4a6080" }} />
            <Bar dataKey="Edges"   stackId="a" fill={CLR_EDGE}   radius={[0,0,0,0]} />
            <Bar dataKey="Corners" stackId="a" fill={CLR_CORNER} radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* E vs C split */}
      <ChartCard title="Edges vs. Corners">
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={pieceBar} layout="vertical" margin={{ left: 8, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
            <XAxis type="number" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={72} stroke={AXIS_COLOR} tick={{ fill: "#ddeeff", fontSize: 13 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="count" name="Fehler" radius={[0,4,4,0]}>
              <Cell fill={CLR_EDGE}   key="edges" />
              <Cell fill={CLR_CORNER} key="corners" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Weekly trend E/C */}
      <ChartCard title="Verlauf — Fehler pro Woche">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={weeklyTotalData} margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="week" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
            <YAxis stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#4a6080" }} />
            <Line type="monotone" dataKey="Edges"   stroke={CLR_EDGE}   strokeWidth={2.5} dot={{ r: 3, fill: CLR_EDGE }}   />
            <Line type="monotone" dataKey="Corners" stroke={CLR_CORNER} strokeWidth={2.5} dot={{ r: 3, fill: CLR_CORNER }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Relative share trend */}
      <ChartCard title="Relative Häufigkeit pro Grund (% je Woche)">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={shareData} margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="week" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
            <YAxis stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR }} unit="%" domain={[0, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#4a6080" }} />
            {macroNames.map((name) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={colorOf(name, macroNames)}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Sub breakdown */}
      {perSub.length > 0 && (
        <ChartCard title="Unterkategorie-Aufschlüsselung">
          <ul className="divide-y divide-border/50">
            {perSub.map((s) => (
              <li key={`${s.macroName}-${s.subName}`}
                  className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="text-muted">{s.macroName} →</span>{" "}
                  <span className="font-medium text-white/90">{s.subName}</span>
                </span>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span style={{ color: CLR_EDGE }}>{s.edges}E</span>
                  <span style={{ color: CLR_CORNER }}>{s.corners}C</span>
                  <span className="font-bold text-white/70">{s.count}×</span>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}

      {/* Recent log */}
      <ChartCard title="Letzte Fehler">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-3 font-medium text-muted text-xs uppercase tracking-wider">Zeitpunkt</th>
                <th className="pb-3 font-medium text-muted text-xs uppercase tracking-wider">Piece</th>
                <th className="pb-3 font-medium text-muted text-xs uppercase tracking-wider">Grund</th>
                <th className="pb-3 font-medium text-muted text-xs uppercase tracking-wider">Sub</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-surface-2/50 transition-colors">
                  <td className="py-2.5 font-mono text-xs text-muted">{fmtDate(r.occurredAt)}</td>
                  <td className="py-2.5">
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${
                      r.pieceType === "edges"
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-accent-2/30 bg-accent-2/10 text-accent-2"
                    }`}>
                      {r.pieceType === "edges" ? "E" : "C"}
                    </span>
                  </td>
                  <td className="py-2.5 font-medium">{r.macroName}</td>
                  <td className="py-2.5 text-muted">{r.subName ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface/70 p-5 backdrop-blur">
      <div className="mb-4 text-xs font-bold uppercase tracking-widest text-muted">{title}</div>
      {children}
    </div>
  );
}

function GlowCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string;
  color: "blue" | "green" | "purple" | "neutral";
}) {
  const styles: Record<typeof color, { border: string; text: string; glow: string }> = {
    blue:    { border: "border-accent/30",    text: "text-accent",    glow: "shadow-neon-blue-sm" },
    green:   { border: "border-accent-2/30",  text: "text-accent-2",  glow: "shadow-neon-green-sm" },
    purple:  { border: "border-purple/30",    text: "text-purple",    glow: "" },
    neutral: { border: "border-border/70",    text: "text-white",     glow: "" },
  };
  const s = styles[color];
  return (
    <div className={`rounded-2xl border bg-surface/70 p-4 backdrop-blur ${s.border} ${s.glow}`}>
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      <div className={`mt-1 truncate text-2xl font-black ${s.text}`} title={String(value)}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
