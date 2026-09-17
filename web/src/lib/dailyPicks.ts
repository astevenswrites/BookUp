import { prisma } from "@/lib/prisma";
import { actorWhere, type Actor } from "@/lib/actor";
import { getDeckForPreference } from "@/lib/matching";
import { getExcludedBookIds } from "@/lib/limits";
import type { PreferenceWithTags } from "@/lib/preferences";

// D35: 5 picks/day, resetting at the actor's own local midnight rather than
// a fixed UTC cutoff.
export const TODAYS_PICKS_COUNT = 5;

export function localDateString(timezone: string | null): string {
  const tz = timezone ?? "UTC";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    // Invalid/unrecognized tz string — fall back rather than 500.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
}

export async function getTodaysPicks(actor: Actor, preference: PreferenceWithTags) {
  const pickDate = localDateString(preference.timezone);

  const existing = await prisma.dailyPick.findMany({
    where: { pickDate, ...actorWhere(actor) },
    include: { book: { include: { tags: { include: { tag: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  if (existing.length > 0) {
    return existing.map((pick) => pick.book);
  }

  const [alreadySwiped, alreadyPicked] = await Promise.all([
    getExcludedBookIds(actor),
    prisma.dailyPick.findMany({ where: actorWhere(actor), select: { bookId: true } }),
  ]);
  const exclude = [...new Set([...alreadySwiped, ...alreadyPicked.map((p) => p.bookId)])];

  // D47: Today's Picks stays pure exploit — a small, fully-curated daily
  // set (D35) shouldn't have the swipe deck's exploration mixed in.
  const { books: picks } = await getDeckForPreference(actor, preference, exclude, TODAYS_PICKS_COUNT, {
    explore: false,
  });
  if (picks.length === 0) return [];

  await prisma.dailyPick.createMany({
    data: picks.map((book) => ({ bookId: book.id, pickDate, ...actorWhere(actor) })),
    skipDuplicates: true,
  });

  return picks;
}
