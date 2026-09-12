// Deterministic tag-overlap matching — the Phase 1 baseline. No ML, no
// collaborative filtering yet (that's Phase 3). See DECISIONS.md D25.
// Whatever replaces this in Phase 3 should be measurably better than this.

import { prisma } from "@/lib/prisma";
import { HeatLevel } from "@/generated/prisma/enums";
import type { BookWithTags } from "@/lib/books";
import type { PreferenceWithTags } from "@/lib/preferences";
import { CATEGORY_WEIGHT, CURRENT_MOOD_BOOST } from "@/lib/matchReasons";

const HEAT_ORDER: HeatLevel[] = [
  HeatLevel.none,
  HeatLevel.low,
  HeatLevel.medium,
  HeatLevel.high,
];

function scoreBook(
  book: BookWithTags,
  likedTagIds: Set<string>,
  heatLevelMax: HeatLevel | null,
  pacing: string | null,
  currentMoodTagId: string | null
): number {
  let score = 0;

  for (const { tag } of book.tags) {
    if (tag.category === "content_warning") continue; // hard-filtered elsewhere, D24
    if (likedTagIds.has(tag.id)) {
      score += CATEGORY_WEIGHT[tag.category] ?? 1;
    }
    if (currentMoodTagId && tag.id === currentMoodTagId) {
      score += CURRENT_MOOD_BOOST;
    }
  }

  if (pacing && book.pacing === pacing) score += 1;

  if (heatLevelMax) {
    const bookIdx = HEAT_ORDER.indexOf(book.heatLevel);
    const maxIdx = HEAT_ORDER.indexOf(heatLevelMax);
    score += bookIdx <= maxIdx ? 1 : -2;
  }

  // small jitter so ties (including an all-zero score for a cold-start
  // preference with no liked tags yet) don't render in the same order every time
  score += Math.random() * 0.5;

  return score;
}

export async function getDeckForPreference(
  preference: PreferenceWithTags,
  excludeBookIds: string[],
  limit: number
): Promise<BookWithTags[]> {
  const avoidTagIds = preference.tags
    .filter(({ tag }) => tag.category === "content_warning")
    .map(({ tagId }) => tagId);

  const likedTagIds = new Set(
    preference.tags
      .filter(({ tag }) => tag.category !== "content_warning")
      .map(({ tagId }) => tagId)
  );

  const candidates = await prisma.book.findMany({
    where: {
      id: { notIn: excludeBookIds.length ? excludeBookIds : undefined },
      ...(avoidTagIds.length
        ? { tags: { none: { tagId: { in: avoidTagIds } } } }
        : {}),
    },
    include: { tags: { include: { tag: true } } },
    take: 300, // cap the scoring pool; plenty of headroom over the current catalog size
  });

  return candidates
    .map((book) => ({
      book,
      score: scoreBook(
        book,
        likedTagIds,
        preference.heatLevelMax,
        preference.pacing,
        preference.currentMoodTagId
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ book }) => book);
}
