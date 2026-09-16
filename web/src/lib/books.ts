import { prisma } from "@/lib/prisma";

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
export async function getBooks(limit = 60) {
  const randomRows = await prisma.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "Book" ORDER BY RANDOM() LIMIT ${limit}`;
  return prisma.book.findMany({
    where: { id: { in: randomRows.map((r) => r.id) } },
    include: { tags: { include: { tag: true } } },
  });
}

// groupTags lives in lib/bookTags.ts — pure, no Prisma import, safe for
// Client Components. Keep it split; see that file's comment for why.
export { groupTags } from "@/lib/bookTags";
export type { GroupedTags } from "@/lib/bookTags";
