import { prisma } from "@/lib/prisma";
import { actorWhere, type Actor } from "@/lib/actor";
import { getExcludedBookIds } from "@/lib/limits";
import type { PreferenceWithTags } from "@/lib/preferences";
import { TbrStatus } from "@/generated/prisma/enums";

// D81: an onboarding step, not a matching feature — readers arrive with a
// real history from Goodreads/StoryGraph/etc., and without a way to say
// "I've already read this," they'll keep surfacing in the deck (Goodreads
// doesn't offer a public read/import API to third-party apps anymore, so
// there's no shortcut through that door). The candidate pool below is
// deliberately biased toward `featured` (D70's "well-known/recently-
// popular" flag) within the reader's chosen genres, NOT raw match score —
// someone's already-read list skews toward the well-known titles in their
// genre, not whichever obscure book happens to score highest against their
// specific mood/trope picks. Falls back to other genre-aligned books if a
// genre combination doesn't have enough featured matches to fill the batch.
function genreFilterFor(preference: PreferenceWithTags) {
  const selectedGenreIds = preference.tags
    .filter(({ tag }) => tag.category === "genre")
    .map(({ tagId }) => tagId);
  return selectedGenreIds.length ? { tags: { some: { tagId: { in: selectedGenreIds } } } } : {};
}

async function candidatePool(actor: Actor, preference: PreferenceWithTags, limit: number) {
  const excludeBookIds = await getExcludedBookIds(actor);
  const genreFilter = genreFilterFor(preference);

  const featured = await prisma.book.findMany({
    where: { ...genreFilter, featured: true, id: { notIn: excludeBookIds } },
    include: { tags: { include: { tag: true } } },
    take: limit,
  });
  if (featured.length >= limit) return featured;

  const fillerExclude = [...excludeBookIds, ...featured.map((b) => b.id)];
  const filler = await prisma.book.findMany({
    where: { ...genreFilter, id: { notIn: fillerExclude } },
    include: { tags: { include: { tag: true } } },
    orderBy: { publishedYear: "desc" }, // more recent leans more likely to be a title they'd recognize
    take: limit - featured.length,
  });
  return [...featured, ...filler];
}

// D81 follow-up: picking books one cover at a time doesn't scale for a
// reader whose backlist is concentrated in a handful of favorite authors —
// "have you read Stephen King" is one decision that can stand in for
// dozens of book-level ones. Draws from a bigger pool than the flat book
// picker (150 vs. 30) specifically so author-dedup has enough to work
// with; `bookCount` here is "how many of that author's books are in THIS
// pool," not their full catalog footprint, so it's a rough "how much this
// might matter to you" signal, not a literal count promise.
const AUTHOR_POOL_SIZE = 150;

export type AuthorCandidate = { author: string; bookCount: number };

export async function getAlreadyReadAuthorCandidates(
  actor: Actor,
  preference: PreferenceWithTags,
  limit: number
): Promise<AuthorCandidate[]> {
  const pool = await candidatePool(actor, preference, AUTHOR_POOL_SIZE);

  const counts = new Map<string, number>();
  for (const book of pool) counts.set(book.author, (counts.get(book.author) ?? 0) + 1);

  return [...counts.entries()]
    .map(([author, bookCount]) => ({ author, bookCount }))
    .sort((a, b) => b.bookCount - a.bookCount || a.author.localeCompare(b.author))
    .slice(0, limit);
}

// Phase 2 of the author-first flow: every book by the selected authors —
// deliberately the WHOLE catalog, not just whatever happened to be in the
// candidate pool above. Saying "I've read Stephen King" should surface
// every Stephen King book we have to check off, not just the ~5 that
// happened to be featured/genre-matched into the pool that surfaced his
// name in the first place.
export async function getBooksByAuthors(actor: Actor, authors: string[]) {
  if (authors.length === 0) return [];
  const excludeBookIds = await getExcludedBookIds(actor);
  return prisma.book.findMany({
    where: { author: { in: authors }, id: { notIn: excludeBookIds } },
    include: { tags: { include: { tag: true } } },
    orderBy: [{ author: "asc" }, { publishedYear: "asc" }],
  });
}

// Bulk-marks books as already read: a TBREntry at `finished` status, no
// Swipe row — this never went through a real swipe decision, and creating
// a fake one would pollute the behavioral-signal data (dwellMs/
// viewedDetails) getImplicitTagWeights reads. getExcludedBookIds already
// covers TBREntry (D81), so this alone is enough to keep these out of
// every deck/pick surface going forward.
//
// D83: `fromOnboardingImport: true` is just as important as the missing
// Swipe row above, for the same reason — a book marked "already read" here
// carries no actual preference judgment (the reader might have hated all
// 60 books by an author they bulk-selected), but status:finished is
// getImplicitTagWeights' single strongest, undecayed signal (see
// matching.ts). Without this flag, onboarding would inject maximum-weight
// "positive" signal for books nobody ever said they liked, capable of
// overriding what the reader just told the quiz. getImplicitTagWeights
// skips any entry with this flag set.
export async function markBooksAsRead(actor: Actor, bookIds: string[]): Promise<void> {
  if (bookIds.length === 0) return;
  await prisma.tBREntry.createMany({
    data: bookIds.map((bookId) => ({
      bookId,
      status: TbrStatus.finished,
      fromOnboardingImport: true,
      ...actorWhere(actor),
    })),
    skipDuplicates: true,
  });
}
