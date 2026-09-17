import "server-only";
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

// D81: was getSwipedBookIds, Swipe-only — every call site used it for the
// same purpose ("this reader has already decided about this book, never
// show it again"), which broke the moment a book could enter TBREntry
// without ever going through a Swipe first (the "mark as already read"
// onboarding step, D81). Every existing TBREntry used to always have a
// paired Swipe row (swipeBook creates both together), so checking Swipe
// alone was sufficient by coincidence, not by design. Unioning both here
// means any future path that adds a TBREntry without a Swipe stays correct
// automatically, instead of becoming a second copy of this exact bug.
export async function getExcludedBookIds(actor: Actor): Promise<string[]> {
  const [swipes, tbrEntries] = await Promise.all([
    prisma.swipe.findMany({ where: actorWhere(actor), select: { bookId: true } }),
    prisma.tBREntry.findMany({ where: actorWhere(actor), select: { bookId: true } }),
  ]);
  return [...new Set([...swipes.map((s) => s.bookId), ...tbrEntries.map((t) => t.bookId)])];
}

// D42: lifetime count, not "today" — an anonymous session's one-time
// preview allowance never resets, unlike DAILY_SWIPE_CAP.
export async function getTotalSwipeCount(actor: Actor): Promise<number> {
  return prisma.swipe.count({ where: actorWhere(actor) });
}

export async function getTbrCount(actor: Actor): Promise<number> {
  return prisma.tBREntry.count({ where: actorWhere(actor) });
}
