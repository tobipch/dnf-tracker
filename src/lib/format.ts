/** Zeit als M:SS.hh bzw. SS.hh – Hundertstel, wie in Cubing-Timern üblich. */
export function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "–";
  const total = Math.max(0, Math.round(ms / 10)); // Hundertstel
  const hundredths = total % 100;
  const seconds = Math.floor(total / 100) % 60;
  const minutes = Math.floor(total / 6000);
  const cs = hundredths.toString().padStart(2, "0");
  if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, "0")}.${cs}`;
  return `${seconds}.${cs}`;
}
