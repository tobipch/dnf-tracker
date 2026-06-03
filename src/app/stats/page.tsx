import { getStats } from "@/db/queries";
import StatsCharts from "@/components/StatsCharts";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const stats = await getStats();

  if (stats.totalDnfs === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold">Noch keine Daten</h1>
        <p className="mt-2 text-muted">Sobald du DNFs erfasst, erscheinen hier deine Statistiken.</p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-white hover:opacity-90"
        >
          Zum Tracker →
        </Link>
      </div>
    );
  }

  return <StatsCharts stats={stats} />;
}
