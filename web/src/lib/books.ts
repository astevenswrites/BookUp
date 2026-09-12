import { prisma } from "@/lib/prisma";

export type BookWithTags = Awaited<ReturnType<typeof getBooks>>[number];

export async function getBooks(limit = 60) {
  return prisma.book.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { tags: { include: { tag: true } } },
  });
}

// groupTags lives in lib/bookTags.ts — pure, no Prisma import, safe for
// Client Components. Keep it split; see that file's comment for why.
export { groupTags } from "@/lib/bookTags";
export type { GroupedTags } from "@/lib/bookTags";
