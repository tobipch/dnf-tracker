"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Stats } from "@/db/queries";

const PALETTE = [
  "#5b8cff",
  "#37d399",
  "#ffb454",
  "#ff5d6c",
  "#b48cff",
  "#4ecbff",
  "#ffd866",
  "#ff85c0",
  "#8ce99a",
  "#c0c4cc",
];

const cardCls = "rounded-xl border border-border bg-surface p-4";
const titleCls = "mb-3 text-sm font-semibold text-muted";

function fmtDate(d: Date) {
  return new Date(d).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StatsCharts({ stats }: { stats: Stats }) {
  const { totalDnfs, perMacro, perSub, weekly, macroNames, recent } = stats;

  const colorOf = (name: string) => PALETTE[macroNames.indexOf(name) % PALETTE.length];

  const topReason = perMacro[0];
  const weeklyTotalData = weekly.map((w) => ({ week: w.week, total: w.total }));
  const shareData = weekly.map((w) => ({ week: w.week, ...w.shares }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Statistiken</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className={cardCls}>
          <div className="text-xs uppercase tracking-wide text-muted">DNFs gesamt</div>
          <div className="mt-1 text-3xl font-bold">{totalDnfs}</div>
        </div>
        <div className={cardCls}>
          <div className="text-xs uppercase tracking-wide text-muted">Häufigster Grund</div>
          <div className="mt-1 truncate text-lg font-semibold" title={topReason?.name}>
            {topReason?.name ?? "–"}
          </div>
          <div className="text-xs text-muted">{topReason ? `${topReason.count}×` : ""}</div>
        </div>
        <div className={cardCls}>
          <div className="text-xs uppercase tracking-wide text-muted">Kategorien</div>
          <div className="mt-1 text-3xl font-bold">{perMacro.length}</div>
        </div>
      </div>

      {/* Frequency per macro */}
      <div className={cardCls}>
        <div className={titleCls}>Häufigkeit pro Grund</div>
        <ResponsiveContainer width="100%" height={Math.max(160, perMacro.length * 38)}>
          <BarChart data={perMacro} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3343" horizontal={false} />
            <XAxis type="number" stroke="#8a94a6" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={130} stroke="#8a94a6" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "#151a23", border: "1px solid #2a3343", borderRadius: 8 }}
              cursor={{ fill: "#ffffff08" }}
            />
            <Bar dataKey="count" name="DNFs" radius={[0, 4, 4, 0]} fill="#5b8cff" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly total over time */}
      <div className={cardCls}>
        <div className={titleCls}>Verlauf über Zeit (DNFs pro Woche)</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={weeklyTotalData} margin={{ left: 0, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3343" />
            <XAxis dataKey="week" stroke="#8a94a6" tick={{ fontSize: 11 }} />
            <YAxis stroke="#8a94a6" allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#151a23", border: "1px solid #2a3343", borderRadius: 8 }} />
            <Line type="monotone" dataKey="total" name="DNFs" stroke="#37d399" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Relative share trend per macro */}
      <div className={cardCls}>
        <div className={titleCls}>Relative Häufigkeit pro Grund (% je Woche)</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={shareData} margin={{ left: 0, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3343" />
            <XAxis dataKey="week" stroke="#8a94a6" tick={{ fontSize: 11 }} />
            <YAxis stroke="#8a94a6" unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: "#151a23", border: "1px solid #2a3343", borderRadius: 8 }}
              formatter={(v: number) => `${v}%`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {macroNames.map((name) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={colorOf(name)}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Per-sub breakdown */}
      {perSub.length > 0 && (
        <div className={cardCls}>
          <div className={titleCls}>Häufigkeit pro Unterkategorie</div>
          <ul className="divide-y divide-border">
            {perSub.map((s) => (
              <li key={`${s.macroName}-${s.subName}`} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="text-muted">{s.macroName} →</span> {s.subName}
                </span>
                <span className="font-mono font-semibold">{s.count}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent log */}
      <div className={cardCls}>
        <div className={titleCls}>Letzte DNFs</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="pb-2 font-medium">Zeitpunkt</th>
                <th className="pb-2 font-medium">Grund</th>
                <th className="pb-2 font-medium">Unterkategorie</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 font-mono text-xs text-muted">{fmtDate(r.occurredAt)}</td>
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
