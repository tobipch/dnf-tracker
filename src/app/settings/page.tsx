import { getReasons, getGoal, getDataCounts } from "@/db/queries";
import { ensureSeeded } from "@/db/seed";
import SettingsManager from "@/components/SettingsManager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await ensureSeeded();
  const [reasons, goal, counts] = await Promise.all([
    getReasons(true),
    getGoal(),
    getDataCounts(),
  ]);
  return <SettingsManager reasons={reasons} goal={goal} counts={counts} />;
}
