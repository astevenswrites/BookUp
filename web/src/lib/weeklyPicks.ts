import { prisma } from "@/lib/prisma";
import { actorWhere, type Actor } from "@/lib/actor";
import { getDeckForPreference } from "@/lib/matching";
import { getExcludedBookIds } from "@/lib/limits";
import { localDateString } from "@/lib/dailyPicks";
import type { PreferenceWithTags } from "@/lib/preferences";

// D75: one selection serves both Phase 3 loose ends — rank 0 is "this
// week's Super Match" (the single highest-scoring unseen book), the rest
// is the weekly drop around it. 10 total: big enough to feel like a drop,
// small enough to stay curated rather than a second deck.
export const WEEKLY_DROP_COUNT = 10;
export const SUPER_MATCH_RANK = 0;

// Same ISO-week-in-the-actor's-own-timezone idea as localDateString
// (dailyPicks.ts) for the day case. No Intl option computes an ISO week
// number directly, so this derives the actor's local calendar date first
// (reusing localDateString, which does the timezone work) and then runs
// the standard ISO-8601 week algorithm (Thursday of the week decides which
// year it belongs to) on that plain date, with no further timezone math.
export function localWeekString(timezone: string | null): string {
  const [y, m, d] = localDateString(timezone).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // shift to this week's Thursday
  const isoYear = date.getUTCFullYear();

  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayNum);

  const weekNum = Math.round((date.getTime() - week1Monday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${isoYear}-W${String(weekNum).padStart(2, "0")}`;
}

// D83: returns `rank` alongside each book, not just a plain Book[] in
// rank order — a page trusting array position 0 to mean "rank 0" breaks
// the moment a persisted pick's book gets deleted out from under it
// (WeeklyPick.book has onDelete: Cascade). That's not hypothetical: a
// persisted weekly pick was already cascade-deleted once this session by
// the children's-book scrub, for the very fantasy test persona this
// feature was built and verified against. Callers should identify the
// Super Match by its actual `rank` field, not by array position.
export type RankedWeeklyPick = { book: Awaited<ReturnType<typeof getDeckForPreference>>["books"][number]; rank: number };

export async function getWeeklyDrop(
  actor: Actor,
  preference: PreferenceWithTags
): Promise<RankedWeeklyPick[]> {
  const weekKey = localWeekString(preference.timezone);

  const existing = await prisma.weeklyPick.findMany({
    where: { weekKey, ...actorWhere(actor) },
    include: { book: { include: { tags: { include: { tag: true } } } } },
    orderBy: { rank: "asc" },
  });
  if (existing.length > 0) {
    return existing.map((pick) => ({ book: pick.book, rank: pick.rank }));
  }

  const [alreadySwiped, alreadyPicked] = await Promise.all([
    getExcludedBookIds(actor),
    prisma.weeklyPick.findMany({ where: actorWhere(actor), select: { bookId: true } }),
  ]);
  const exclude = [...new Set([...alreadySwiped, ...alreadyPicked.map((p) => p.bookId)])];

  // Pure exploit, same call as getTodaysPicks (D47) — a small, fully-
  // curated set shouldn't have the swipe deck's exploration mixed in, and
  // getDeckForPreference with explore:false returns books sorted by score
  // descending, which is what makes rank 0 legitimately "the Super Match"
  // rather than an arbitrary pick among equals.
  const { books: picks } = await getDeckForPreference(actor, preference, exclude, WEEKLY_DROP_COUNT, {
    explore: false,
  });
  if (picks.length === 0) return [];

  await prisma.weeklyPick.createMany({
    data: picks.map((book, rank) => ({ bookId: book.id, weekKey, rank, ...actorWhere(actor) })),
    skipDuplicates: true,
  });

  return picks.map((book, rank) => ({ book, rank }));
}
