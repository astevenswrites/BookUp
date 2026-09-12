import { prisma } from "@/lib/prisma";

export { DAILY_SWIPE_CAP } from "@/lib/constants";

function utcMidnightToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getTodaySwipeCount(sessionId: string): Promise<number> {
  return prisma.swipe.count({
    where: { sessionId, createdAt: { gte: utcMidnightToday() } },
  });
}

export async function getSwipedBookIds(sessionId: string): Promise<string[]> {
  const swipes = await prisma.swipe.findMany({
    where: { sessionId },
    select: { bookId: true },
  });
  return swipes.map((s) => s.bookId);
}
