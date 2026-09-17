import { prisma } from "@/lib/prisma";
import { actorWhere, type Actor } from "@/lib/actor";
import { localDateString } from "@/lib/dailyPicks";

// D79: one calendar day, in the actor's own local timezone, of "yesterday"
// relative to a given YYYY-MM-DD string — plain date arithmetic (UTC noon
// anchor avoids DST-transition edge cases shifting the date by a day),
// no timezone math needed here since localDateString already resolved the
// actor's local calendar date.
function previousDateString(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// Called on every swipe (swipeBook, actions.ts). A day only ever advances
// the streak once — a second swipe the same local day is a no-op, not a
// double-count. Missing a day resets to 1 (today counts), not 0.
export async function recordSwipeActivity(actor: Actor): Promise<void> {
  const preference = await prisma.preference.findFirst({
    where: actorWhere(actor),
    select: { id: true, timezone: true, currentStreak: true, longestStreak: true, lastActiveDate: true },
  });
  if (!preference) return; // no quiz taken yet — nothing to track against

  const today = localDateString(preference.timezone);

  if (preference.lastActiveDate === today) return; // already counted today

  const wasYesterday = preference.lastActiveDate === previousDateString(today);
  const newStreak = wasYesterday ? preference.currentStreak + 1 : 1;

  await prisma.preference.update({
    where: { id: preference.id },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, preference.longestStreak),
      lastActiveDate: today,
    },
  });
}

// D79: a streak "goes cold" the moment a day is missed, but we only ever
// write that on the *next* swipe (recordSwipeActivity resets it then) —
// reading currentStreak straight off Preference between visits would keep
// showing yesterday's number even after a day's been skipped. This is the
// read-side equivalent: what the streak WOULD be if evaluated right now,
// without writing anything (a page render must never have a write side
// effect). Today's Picks/Weekly Drop pages call getWeeklyDrop/getTodaysPicks
// which don't touch this at all — this is purely for display.
export function displayedStreak(
  currentStreak: number,
  lastActiveDate: string | null,
  timezone: string | null
): number {
  if (!lastActiveDate) return 0;
  const today = localDateString(timezone);
  if (lastActiveDate === today || lastActiveDate === previousDateString(today)) {
    return currentStreak;
  }
  return 0; // missed more than one day — cold, until the next swipe resets it to 1
}
