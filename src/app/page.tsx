import { getTrackerData } from "@/db/queries";
import { ensureSeeded } from "@/db/seed";
import Tracker from "@/components/Tracker";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureSeeded();
  const data = await getTrackerData();
  return <Tracker data={data} />;
}
