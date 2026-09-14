import { prisma } from "@/lib/prisma";
import { TagCategory } from "@/generated/prisma/enums";

// D44: genre gets asked early in the quiz, and trope/mood options are
// filtered/prioritized by which genres they actually show up on — computed
// from real Book<->Tag associations rather than a hand-maintained mapping,
// so it stays accurate as the catalog grows (a real catalog import later
// needs no parallel config to keep in sync).
export type TagOption = { id: string; label: string; relevantGenres?: string[] };
export type TagsByCategory = Record<TagCategory, TagOption[]>;

export async function getTagsByCategory(): Promise<TagsByCategory> {
  const tags = await prisma.tag.findMany({ orderBy: { label: "asc" } });
  const grouped: TagsByCategory = {
    genre: [],
    trope: [],
    mood: [],
    content_warning: [],
  };

  const genreAffinity = await getGenreAffinity();
  for (const t of tags) {
    grouped[t.category].push({
      id: t.id,
      label: t.label,
      relevantGenres: genreAffinity.get(t.id),
    });
  }
  return grouped;
}

// For each trope/mood tag, which genre labels it actually co-occurs with on
// at least one book in the catalog.
async function getGenreAffinity(): Promise<Map<string, string[]>> {
  const books = await prisma.book.findMany({
    select: { tags: { select: { tag: { select: { id: true, label: true, category: true } } } } },
  });

  const affinity = new Map<string, Set<string>>();
  for (const book of books) {
    const genreLabels = book.tags
      .map(({ tag }) => tag)
      .filter((tag) => tag.category === TagCategory.genre)
      .map((tag) => tag.label);
    if (genreLabels.length === 0) continue;

    for (const { tag } of book.tags) {
      if (tag.category !== TagCategory.trope && tag.category !== TagCategory.mood) continue;
      const existing = affinity.get(tag.id) ?? new Set<string>();
      for (const label of genreLabels) existing.add(label);
      affinity.set(tag.id, existing);
    }
  }

  return new Map([...affinity].map(([id, labels]) => [id, [...labels]]));
}
