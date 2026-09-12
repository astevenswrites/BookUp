// D36: a to_read entry untouched for 21+ days gets a "still interested?"
// re-prompt on the shelf. `updatedAt` doubles as "last touched" — bumped by
// any status change or by explicitly dismissing the prompt (keepTbrEntry).
export const STALE_AFTER_DAYS = 21;

export function isStale(entry: { status: string; updatedAt: Date }): boolean {
  if (entry.status !== "to_read") return false;
  const ageMs = Date.now() - entry.updatedAt.getTime();
  return ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}
