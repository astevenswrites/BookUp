import { prisma } from "@/lib/prisma";
import { TbrStatus } from "@/generated/prisma/enums";
import { getDeckForPreference, type DeckResult } from "@/lib/matching";
import { actorWhere, type Actor } from "@/lib/actor";
import type { PreferenceWithTags } from "@/lib/preferences";

// D86: seasonal/genre reading challenges are discovery-first, completion
// second (explicit user call) — the primary job is surfacing genre books
// worth reading, personalized to the reader, not a completion checklist.
// A challenge is fully defined by genre + date range + a target count, so
// it's cheap enough to hand-maintain here rather than a DB table + admin
// UI — same maintenance model as prisma/curate-featured.ts's hand-picked
// lists. Add/edit entries by hand when a new season rolls around.
export type Challenge = {
  id: string;
  label: string;
  emoji: string;
  genreLabel: string;
  startDate: string; // YYYY-MM-DD, same shape as DailyPick.pickDate/WeeklyPick.weekKey
  endDate: string; // YYYY-MM-DD, inclusive
  target: number;
};

export const CHALLENGES: Challenge[] = [
  {
    id: "spooky-season-2026",
    label: "Spooky Season",
    emoji: "🎃",
    genreLabel: "Horror",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    target: 3,
  },
];

export function getActiveChallenges(today: string): Challenge[] {
  return CHALLENGES.filter((c) => c.startDate <= today && today <= c.endDate);
}

// The primary function: a personalized, genre-scoped discovery deck, not a
// plain "every Horror book" list. Reuses the entire existing personalization
// stack (implicit weights, collaborative boosts, mood/heat/pacing scoring)
// via getDeckForPreference's genreTagId option — this is what makes it
// "books picked for you this Spooky Season."
export async function getChallengeBooks(
  actor: Actor,
  preference: PreferenceWithTags,
  challenge: Challenge,
  excludeBookIds: string[],
  limit = 20
): Promise<DeckResult> {
  const genreTag = await prisma.tag.findUnique({
    where: { label_category: { label: challenge.genreLabel, category: "genre" } },
  });
  if (!genreTag) return { books: [], tagWeights: {}, collaborativeBoosts: {} };

  return getDeckForPreference(actor, preference, excludeBookIds, limit, {
    explore: false,
    genreTagId: genreTag.id,
  });
}

// Secondary: how many of the challenge's genre has this reader actually
// finished during the window — encouragement layered on top of discovery,
// not the headline. Excludes onboarding-imported "already read" entries
// (fromOnboardingImport) since those weren't actually read during the
// challenge — same exclusion reasoning as D83's matching fix.
export async function getChallengeProgress(
  actor: Actor,
  challenge: Challenge
): Promise<{ completed: number; bookTitles: string[] }> {
  const start = new Date(`${challenge.startDate}T00:00:00.000Z`);
  const end = new Date(`${challenge.endDate}T23:59:59.999Z`);

  const entries = await prisma.tBREntry.findMany({
    where: {
      ...actorWhere(actor),
      status: TbrStatus.finished,
      fromOnboardingImport: false,
      finishedAt: { gte: start, lte: end },
      book: { tags: { some: { tag: { category: "genre", label: challenge.genreLabel } } } },
    },
    select: { book: { select: { title: true } } },
  });

  return { completed: entries.length, bookTitles: entries.map((e) => e.book.title) };
}
