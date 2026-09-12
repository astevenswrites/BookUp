import { prisma } from "@/lib/prisma";
import { TagCategory } from "@/generated/prisma/enums";

export type TagOption = { id: string; label: string };
export type TagsByCategory = Record<TagCategory, TagOption[]>;

export async function getTagsByCategory(): Promise<TagsByCategory> {
  const tags = await prisma.tag.findMany({ orderBy: { label: "asc" } });
  const grouped: TagsByCategory = {
    genre: [],
    trope: [],
    mood: [],
    content_warning: [],
  };
  for (const t of tags) {
    grouped[t.category].push({ id: t.id, label: t.label });
  }
  return grouped;
}
