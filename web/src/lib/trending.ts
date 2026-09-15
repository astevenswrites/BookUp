// D50: "what's popular across everyone," deliberately decoupled from
// personal fit — the opposite end of the spectrum from Blind Date's
// Community Pick (lib/blindDate.ts), which specifically requires the
// picker to be a reader whose taste resembles yours. Trending doesn't care
// about that at all; it's a ranked list, not a single pick.

import { prisma } from "@/lib/prisma";
import { TbrStatus } from "@/generated/prisma/enums";
import type { BookWithTags } from "@/lib/books";
import type { PreferenceWithTags } from "@/lib/preferences";
import type { Actor } from "@/lib/actor";

export const TRENDING_COUNT = 20;

function contentWarningFilter(preference: PreferenceWithTags) {
  const avoidTagIds = preference.tags
    .filter(({ tag }) => tag.category === "content_warning")
    .map(({ tagId }) => tagId);
  return avoidTagIds.length ? { tags: { none: { tagId: { in: avoidTagIds } } } } : {};
}

// Still hard-filters content warnings (D24 is safety-critical, not a
// per-feature opt-in) and still excludes what the actor's already decided
// on — otherwise identical to "most finished/added across every reader."
export async function getTrendingBooks(
  actor: Actor,
  preference: PreferenceWithTags,
  excludeBookIds: string[],
  limit = TRENDING_COUNT
): Promise<BookWithTags[]> {
  const selfClause = actor.kind === "user" ? [{ userId: { not: actor.userId } }] : [];
  const cwClause = preference.tags.some(({ tag }) => tag.category === "content_warning")
    ? [{ book: contentWarningFilter(preference) }]
    : [];

  const grouped = await prisma.tBREntry.groupBy({
    by: ["bookId"],
    where: {
      AND: [
        { userId: { not: null } },
        ...selfClause,
        { bookId: { notIn: excludeBookIds.length ? excludeBookIds : undefined } },
        { status: { in: [TbrStatus.finished, TbrStatus.reading, TbrStatus.to_read] } },
        ...cwClause,
      ],
    },
    _count: { bookId: true },
    orderBy: { _count: { bookId: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const books = await prisma.book.findMany({
    where: { id: { in: grouped.map((g) => g.bookId) } },
    include: { tags: { include: { tag: true } } },
  });
  const byId = new Map(books.map((b) => [b.id, b]));
  // groupBy doesn't preserve orderBy in the returned row order reliably
  // across all providers — resolve to books in the ranked bookId order explicitly.
  return grouped.map((g) => byId.get(g.bookId)).filter((b): b is BookWithTags => Boolean(b));
}
