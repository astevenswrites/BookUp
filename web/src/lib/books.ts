import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type BookWithTags = Awaited<ReturnType<typeof getBooks>>[number];

// D68: used only by /review, the design-QA grid — its own header says
// "for reviewing the card design across variety." `orderBy: createdAt desc`
// silently stopped delivering that once the catalog grew past one seed
// batch: with the real-book import split across two createMany calls (and
// each batch's rows sharing one now() timestamp), "most recent 60" could
// land entirely inside a single batch — which, purely by where that batch's
// slice fell in the fixture's genre-bucketed array order, was almost all
// Romantasy. Random sampling across the whole table is what the page
// actually wants, not recency.
//
// D70: biased toward `featured` books (a curated "worth showcasing" flag,
// not a rating — see D67) so the page leads with well-known/recently-
// popular and hand-picked indie titles, then fills the rest randomly across
// the whole catalog for variety.
export async function getBooks(limit = 60) {
  const featuredTarget = Math.min(24, limit);
  const featuredRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Book" WHERE "featured" = true ORDER BY RANDOM() LIMIT ${featuredTarget}
  `;

  const remaining = limit - featuredRows.length;
  const exclude =
    featuredRows.length > 0
      ? Prisma.sql`WHERE id NOT IN (${Prisma.join(featuredRows.map((r) => r.id))})`
      : Prisma.empty;
  const randomRows =
    remaining > 0
      ? await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Book" ${exclude} ORDER BY RANDOM() LIMIT ${remaining}
        `
      : [];

  const ids = [...featuredRows, ...randomRows].map((r) => r.id);
  const books = await prisma.book.findMany({
    where: { id: { in: ids } },
    include: { tags: { include: { tag: true } } },
  });

  // Keep the featured-first ordering findMany doesn't guarantee.
  const byId = new Map(books.map((b) => [b.id, b]));
  return ids.map((id) => byId.get(id)!).filter(Boolean);
}

// groupTags lives in lib/bookTags.ts — pure, no Prisma import, safe for
// Client Components. Keep it split; see that file's comment for why.
export { groupTags } from "@/lib/bookTags";
export type { GroupedTags } from "@/lib/bookTags";
