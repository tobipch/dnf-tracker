import { getMacrosWithSubs } from "@/db/queries";
import Tracker from "@/components/Tracker";

export const dynamic = "force-dynamic";

export default async function Home() {
  const macros = await getMacrosWithSubs();
  return <Tracker macros={macros} />;
}
