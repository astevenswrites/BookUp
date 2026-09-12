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

export type MatchReason = { label: string; category: TagCategory; weight: number };

// D40: "Why this one" rail — the actual tags that scored this book, so the
// matching algorithm isn't a black box. Mirrors scoreBook's tag-overlap
// logic exactly (content warnings never shown here — they're hard-filtered
// before a book is ever a candidate, D24, not a "match reason").
export function getMatchReasons(
  book: BookWithTags,
  likedTagIds: Set<string>,
  currentMoodTagId: string | null
): MatchReason[] {
  const reasons: MatchReason[] = [];
  for (const { tag } of book.tags) {
    if (tag.category === "content_warning") continue;
    if (currentMoodTagId && tag.id === currentMoodTagId) {
      reasons.push({
        label: tag.label,
        category: tag.category,
        weight: (CATEGORY_WEIGHT[tag.category] ?? 1) + CURRENT_MOOD_BOOST,
      });
    } else if (likedTagIds.has(tag.id)) {
      reasons.push({ label: tag.label, category: tag.category, weight: CATEGORY_WEIGHT[tag.category] ?? 1 });
    }
  }
  return reasons.sort((a, b) => b.weight - a.weight);
}
