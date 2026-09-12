import { prisma } from "@/lib/prisma";
import { actorWhere, type Actor } from "@/lib/actor";

export { DAILY_SWIPE_CAP } from "@/lib/constants";

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
