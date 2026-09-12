// Pure helper, no Prisma import — safe for Client Components (BookCard is
// rendered client-side inside SwipeDeck). Keep it that way; importing
// anything from lib/books.ts at runtime pulls Prisma/pg into the client bundle.
import type { TagCategory } from "@/generated/prisma/enums";
import type { BookWithTags } from "@/lib/books";

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
