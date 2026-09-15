// D48/D50: Blind Date has two separate, explicit entry points (not one
// blended feature) — "Surprise Me" (algorithmic, always works, no
// user-count dependency) and "Community Pick" (readers whose taste profile
// actually resembles yours, honest about needing real similar readers
// rather than faking a result when there aren't enough). Community-wide
// popularity regardless of personal fit is a separate concept — see
// lib/trending.ts, not this file.

import { prisma } from "@/lib/prisma";
import { TbrStatus } from "@/generated/prisma/enums";
import type { BookWithTags } from "@/lib/books";
import type { PreferenceWithTags } from "@/lib/preferences";
import { getPreferenceForActor } from "@/lib/preferences";
import type { Actor } from "@/lib/actor";
import { explicitWeightsFromPreference, getImplicitTagWeights, mergeWeights, profileSimilarity } from "@/lib/matching";

function contentWarningFilter(preference: PreferenceWithTags) {
  const avoidTagIds = preference.tags
    .filter(({ tag }) => tag.category === "content_warning")
    .map(({ tagId }) => tagId);
  return avoidTagIds.length ? { tags: { none: { tagId: { in: avoidTagIds } } } } : {};
}

// D50: "surprising, not blind" — a genuine departure needs an anchor of
// familiarity or it just reads as noise. Candidates are restricted to books
// sharing 1-3 tags the reader actually has positive weight on (explicit or
// implicit, confident or not — any positive signal counts as "familiar"
// here); the rest of the book's tags are free to be unfamiliar territory.
// Falls back to the full candidate pool only if literally nothing qualifies
// (e.g. a preference with no positive-weight tags at all yet).
const MIN_FAMILIAR_TAGS = 1;
const MAX_FAMILIAR_TAGS = 3;

export async function getTangentialPick(
  actor: Actor,
  preference: PreferenceWithTags,
  excludeBookIds: string[]
): Promise<BookWithTags | null> {
  const candidates = await prisma.book.findMany({
    where: {
      id: { notIn: excludeBookIds.length ? excludeBookIds : undefined },
      ...contentWarningFilter(preference),
    },
    include: { tags: { include: { tag: true } } },
    take: 300,
  });
  if (candidates.length === 0) return null;

  const implicit = await getImplicitTagWeights(actor);
  const tagWeights = mergeWeights(explicitWeightsFromPreference(preference), implicit.stable, implicit.emerging);

  function familiarTagCount(book: BookWithTags): number {
    return book.tags.filter(
      ({ tag }) => tag.category !== "content_warning" && (tagWeights.get(tag.id) ?? 0) > 0
    ).length;
  }

  const qualifying = candidates.filter((book) => {
    const count = familiarTagCount(book);
    return count >= MIN_FAMILIAR_TAGS && count <= MAX_FAMILIAR_TAGS;
  });
  const pool = qualifying.length > 0 ? qualifying : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

// D50: "readers like you," not "whatever's popular" — only signed-in users
// whose combined (explicit + implicit) tag-weight profile is at least this
// cosine-similar to the actor's own count as "a reader like you." This is a
// higher, more specific bar than D46's getCollaborativeBoosts (which just
// ranks by raw book-overlap count for the main deck's scoring nudge) —
// Community Pick is a single deliberate pick, so it's worth being pickier
// about who "like you" means.
const PROFILE_SIMILARITY_THRESHOLD = 0.75;

export type CommunityPickResult =
  | { status: "ok"; book: BookWithTags }
  | { status: "insufficient_data" };

export async function getCommunityPick(
  actor: Actor,
  preference: PreferenceWithTags,
  excludeBookIds: string[]
): Promise<CommunityPickResult> {
  if (actor.kind !== "user") return { status: "insufficient_data" };

  const myImplicit = await getImplicitTagWeights(actor);
  const myWeights = mergeWeights(explicitWeightsFromPreference(preference), myImplicit.stable);

  const otherUsers = await prisma.user.findMany({
    where: { id: { not: actor.userId } },
    select: { id: true },
  });

  const similarUserIds: string[] = [];
  for (const other of otherUsers) {
    const otherActor: Actor = { kind: "user", userId: other.id };
    const otherPreference = await getPreferenceForActor(otherActor);
    if (!otherPreference) continue;
    const otherImplicit = await getImplicitTagWeights(otherActor);
    const otherWeights = mergeWeights(explicitWeightsFromPreference(otherPreference), otherImplicit.stable);
    if (profileSimilarity(myWeights, otherWeights) >= PROFILE_SIMILARITY_THRESHOLD) {
      similarUserIds.push(other.id);
    }
  }
  if (similarUserIds.length === 0) return { status: "insufficient_data" };

  const cwClause = preference.tags.some(({ tag }) => tag.category === "content_warning")
    ? [{ book: contentWarningFilter(preference) }]
    : [];

  const grouped = await prisma.tBREntry.groupBy({
    by: ["bookId"],
    where: {
      AND: [
        { userId: { in: similarUserIds } },
        { bookId: { notIn: excludeBookIds.length ? excludeBookIds : undefined } },
        { status: { in: [TbrStatus.finished, TbrStatus.reading, TbrStatus.to_read] } },
        ...cwClause,
      ],
    },
    _count: { bookId: true },
    orderBy: { _count: { bookId: "desc" } },
    take: 20,
  });
  if (grouped.length === 0) return { status: "insufficient_data" };

  const topCount = grouped[0]._count.bookId;
  const topTier = grouped.filter((g) => g._count.bookId === topCount);
  const chosen = topTier[Math.floor(Math.random() * topTier.length)];

  const book = await prisma.book.findUnique({
    where: { id: chosen.bookId },
    include: { tags: { include: { tag: true } } },
  });
  return book ? { status: "ok", book } : { status: "insufficient_data" };
}
