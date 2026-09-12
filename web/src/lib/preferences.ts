import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/actor";

export async function getPreferenceForActor(actor: Actor) {
  if (actor.kind === "user") {
    return prisma.preference.findUnique({
      where: { userId: actor.userId },
      include: { tags: { include: { tag: true } } },
    });
  }
  return prisma.preference.findUnique({
    where: { sessionId: actor.sessionId },
    include: { tags: { include: { tag: true } } },
  });
}

export type PreferenceWithTags = NonNullable<
  Awaited<ReturnType<typeof getPreferenceForActor>>
>;

export function getPreferenceMoodLabels(preference: PreferenceWithTags): string[] {
  return preference.tags
    .filter(({ tag }) => tag.category === "mood")
    .map(({ tag }) => tag.label);
}
