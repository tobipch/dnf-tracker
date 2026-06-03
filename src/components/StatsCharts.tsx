"use client";

import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import type { Stats } from "@/db/queries";

const CLR_EDGE = "#5b8cff";
const CLR_CORNER = "#37d399";
const PALETTE = ["#5b8cff", "#37d399", "#ffb454", "#ff5d6c", "#b48cff", "#4ecbff", "#ffd866", "#ff85c0", "#8ce99a", "#c0c4cc"];

const cardCls = "rounded-xl border border-border bg-surface p-4";
const titleCls = "mb-3 text-sm font-semibold text-muted uppercase tracking-wide";

function fmtDate(d: Date) {
  return new Date(d).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function StatsCharts({ stats }: { stats: Stats }) {
  const { totalDnfs, totalEdges, totalCorners, perMacro, perSub, weekly, macroNames, recent } = stats;

  const colorOf = (name: string) => PALETTE[macroNames.indexOf(name) % PALETTE.length];
  const edgePct = totalDnfs > 0 ? Math.round((totalEdges / totalDnfs) * 100) : 0;
  const cornerPct = 100 - edgePct;

  const pieceOverview = [
    { name: "Edges", count: totalEdges },
    { name: "Corners", count: totalCorners },
  ];

  const weeklyTotalData = weekly.map((w) => ({ week: w.week, Edges: w.edges, Corners: w.corners }));
  const shareData = weekly.map((w) => ({ week: w.week, ...w.shares }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Statistiken</h1>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Fehler gesamt" value={totalDnfs} />
        <SummaryCard label="Edges" value={totalEdges} sub={`${edgePct}%`} color={CLR_EDGE} />
        <SummaryCard label="Corners" value={totalCorners} sub={`${cornerPct}%`} color={CLR_CORNER} />
        <SummaryCard label="Häufigster Grund" value={perMacro[0]?.name ?? "–"} sub={perMacro[0] ? `${perMacro[0].count}×` : ""} />
      </div>

      {/* Edges vs Corners per macro — stacked bar */}
      <div className={cardCls}>
        <div className={titleCls}>Häufigkeit pro Grund (Edges / Corners)</div>
        <ResponsiveContainer width="100%" height={Math.max(160, perMacro.length * 44)}>
          <BarChart
            data={perMacro.map((m) => ({ name: m.name, Edges: m.edges, Corners: m.corners }))}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3343" horizontal={false} />
            <XAxis type="number" stroke="#8a94a6" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={140} stroke="#8a94a6" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "#151a23", border: "1px solid #2a3343", borderRadius: 8 }} cursor={{ fill: "#ffffff08" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Edges" stackId="a" fill={CLR_EDGE} radius={[0, 0, 0, 0]} />
            <Bar dataKey="Corners" stackId="a" fill={CLR_CORNER} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Edges vs Corners split (donut-style: simple two bars) */}
      <div className={cardCls}>
        <div className={titleCls}>Edges vs. Corners — Gesamtverteilung</div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={pieceOverview} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3343" horizontal={false} />
            <XAxis type="number" stroke="#8a94a6" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={70} stroke="#8a94a6" tick={{ fontSize: 13 }} />
            <Tooltip contentStyle={{ background: "#151a23", border: "1px solid #2a3343", borderRadius: 8 }} cursor={{ fill: "#ffffff08" }} />
            <Bar dataKey="count" name="Fehler" radius={[0, 4, 4, 0]}>
              <Cell fill={CLR_EDGE} />
              <Cell fill={CLR_CORNER} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly Edges + Corners trend */}
      <div className={cardCls}>
        <div className={titleCls}>Verlauf über Zeit — Fehler pro Woche</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={weeklyTotalData} margin={{ left: 0, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3343" />
            <XAxis dataKey="week" stroke="#8a94a6" tick={{ fontSize: 11 }} />
            <YAxis stroke="#8a94a6" allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#151a23", border: "1px solid #2a3343", borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Edges" stroke={CLR_EDGE} strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="Corners" stroke={CLR_CORNER} strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Relative share per macro per week */}
      <div className={cardCls}>
        <div className={titleCls}>Relative Häufigkeit pro Grund (% je Woche)</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={shareData} margin={{ left: 0, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3343" />
            <XAxis dataKey="week" stroke="#8a94a6" tick={{ fontSize: 11 }} />
            <YAxis stroke="#8a94a6" unit="%" domain={[0, 100]} />
            <Tooltip contentStyle={{ background: "#151a23", border: "1px solid #2a3343", borderRadius: 8 }} formatter={(v: number) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {macroNames.map((name) => (
              <Line key={name} type="monotone" dataKey={name} stroke={colorOf(name)} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sub breakdown */}
      {perSub.length > 0 && (
        <div className={cardCls}>
          <div className={titleCls}>Häufigkeit pro Unterkategorie</div>
          <ul className="divide-y divide-border">
            {perSub.map((s) => (
              <li key={`${s.macroName}-${s.subName}`} className="flex items-center justify-between py-2 text-sm">
                <span><span className="text-muted">{s.macroName} →</span> {s.subName}</span>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span style={{ color: CLR_EDGE }}>{s.edges}E</span>
                  <span style={{ color: CLR_CORNER }}>{s.corners}C</span>
                  <span className="font-semibold">{s.count}×</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent log */}
      <div className={cardCls}>
        <div className={titleCls}>Letzte Fehler</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="pb-2 font-medium">Zeitpunkt</th>
                <th className="pb-2 font-medium">Piece</th>
                <th className="pb-2 font-medium">Grund</th>
                <th className="pb-2 font-medium">Unterkategorie</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 font-mono text-xs text-muted">{fmtDate(r.occurredAt)}</td>
                  <td className="py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                      r.pieceType === "edges" ? "bg-accent/15 text-accent" : "bg-accent-2/15 text-accent-2"
                    }`}>
                      {r.pieceType === "edges" ? "E" : "C"}
                    </span>
                  </td>
                  <td className="py-2">{r.macroName}</td>
                  <td className="py-2 text-muted">{r.subName ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={cardCls}>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 truncate text-2xl font-bold" style={color ? { color } : undefined} title={String(value)}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
