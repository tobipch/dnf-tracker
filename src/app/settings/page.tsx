import { getMacrosWithSubs } from "@/db/queries";
import SettingsManager from "@/components/SettingsManager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const macros = await getMacrosWithSubs();
  return <SettingsManager macros={macros} />;
}
