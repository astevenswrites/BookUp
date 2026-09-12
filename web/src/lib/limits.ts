import { prisma } from "@/lib/prisma";
import { actorWhere, type Actor } from "@/lib/actor";

export { DAILY_SWIPE_CAP, ANONYMOUS_PREVIEW_SWIPE_CAP } from "@/lib/constants";

function utcMidnightToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getTodaySwipeCount(actor: Actor): Promise<number> {
  return prisma.swipe.count({
    where: { ...actorWhere(actor), createdAt: { gte: utcMidnightToday() } },
  });
}

export async function getSwipedBookIds(actor: Actor): Promise<string[]> {
  const swipes = await prisma.swipe.findMany({
    where: actorWhere(actor),
    select: { bookId: true },
  });
  return swipes.map((s) => s.bookId);
}

// D42: lifetime count, not "today" — an anonymous session's one-time
// preview allowance never resets, unlike DAILY_SWIPE_CAP.
export async function getTotalSwipeCount(actor: Actor): Promise<number> {
  return prisma.swipe.count({ where: actorWhere(actor) });
}

export async function getTbrCount(actor: Actor): Promise<number> {
  return prisma.tBREntry.count({ where: actorWhere(actor) });
}
