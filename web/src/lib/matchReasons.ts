// Pure, no Prisma import — safe for Client Components (SwipeDeck renders the
// "Why this one" rail client-side as the top card changes). See D32/D40.
// Weights here are the single source of truth; lib/matching.ts's scoreBook
// imports them so the displayed "×3"/"×6" always matches what actually
// drove the ranking.
import type { TagCategory } from "@/generated/prisma/enums";
import type { BookWithTags } from "@/lib/books";

export const CATEGORY_WEIGHT: Record<string, number> = {
  mood: 3,
  trope: 3,
  genre: 1,
};

// D39: "what do you feel like reading today?" boost, on top of the base
// mood weight above.
export const CURRENT_MOOD_BOOST = 6;

export type MatchReason = { label: string; category: TagCategory | "collaborative"; weight: number };

// D40/D45/D46: "Why this one" rail — the actual signals that scored this
// book, so the matching algorithm isn't a black box. `tagWeights` is the
// combined explicit (quiz) + implicit (behavioral history) weight per tag,
// exactly what scoreBook itself summed — a positive weight here is a real
// contributor to the ranking, not just an explicit quiz pick anymore.
// (Content warnings never shown here — hard-filtered before a book is ever
// a candidate, D24, not a "match reason".)
export function getMatchReasons(
  book: BookWithTags,
  tagWeights: Map<string, number>,
  currentMoodTagId: string | null,
  collaborativeBoost = 0
): MatchReason[] {
  const reasons: MatchReason[] = [];
  for (const { tag } of book.tags) {
    if (tag.category === "content_warning") continue;
    const weight = tagWeights.get(tag.id) ?? 0;
    if (currentMoodTagId && tag.id === currentMoodTagId) {
      reasons.push({ label: tag.label, category: tag.category, weight: weight + CURRENT_MOOD_BOOST });
    } else if (weight > 0) {
      reasons.push({ label: tag.label, category: tag.category, weight: Math.round(weight * 10) / 10 });
    }
  }
  if (collaborativeBoost > 0) {
    reasons.push({
      label: "readers with similar taste",
      category: "collaborative",
      weight: Math.round(collaborativeBoost * 10) / 10,
    });
  }
  return reasons.sort((a, b) => b.weight - a.weight);
}
