/** Local calendar day key, e.g. "2026-07-18". */
export function localDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function distinctLocalDays(timestamps: number[]): string[] {
  return [...new Set(timestamps.map(localDayKey))].sort();
}

export function formatRelativeDay(timestamp: number, now: number = Date.now()): string {
  const dayDiff = Math.round(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(timestamp).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (dayDiff <= 0) return "today";
  if (dayDiff === 1) return "yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
