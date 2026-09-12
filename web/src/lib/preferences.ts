import { prisma } from "@/lib/prisma";

export async function getPreferenceForSession(sessionId: string) {
  return prisma.preference.findUnique({
    where: { sessionId },
    include: { tags: { include: { tag: true } } },
  });
}

export type PreferenceWithTags = NonNullable<
  Awaited<ReturnType<typeof getPreferenceForSession>>
>;
