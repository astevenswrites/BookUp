import { prisma } from "@/lib/prisma";
import type { TagCategory } from "@/generated/prisma/enums";

export type BookWithTags = Awaited<ReturnType<typeof getBooks>>[number];

export async function getBooks(limit = 60) {
  return prisma.book.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { tags: { include: { tag: true } } },
  });
}

export type GroupedTags = Record<TagCategory, string[]>;

export function groupTags(book: BookWithTags): GroupedTags {
  const grouped: GroupedTags = {
    genre: [],
    trope: [],
    mood: [],
    content_warning: [],
  };
  for (const { tag } of book.tags) {
    grouped[tag.category].push(tag.label);
  }
  return grouped;
}
