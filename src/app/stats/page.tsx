import { getStats } from "@/db/queries";
import { ensureSeeded } from "@/db/seed";
import StatsView from "@/components/StatsView";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  await ensureSeeded();
  const stats = await getStats();

  if (stats.totals.attempts === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <h1 className="text-xl font-black">Noch keine Daten</h1>
        <p className="mt-2 text-muted">
          Sobald du Versuche erfasst, erscheinen hier deine Statistiken.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-xl border border-accent/50 bg-accent/10 px-5 py-2.5 font-bold text-accent"
        >
          Zum Tracker →
        </Link>
      </div>
    );
  }

  return <StatsView stats={stats} />;
}
