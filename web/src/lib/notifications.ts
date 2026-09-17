import { prisma } from "@/lib/prisma";
import { TbrStatus } from "@/generated/prisma/enums";
import { actorWhere, type Actor } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";
import { localDateString } from "@/lib/dailyPicks";
import { localWeekString } from "@/lib/weeklyPicks";

// D86: structure-prep only — this module decides WHAT (if anything) an
// actor should be notified about; nothing here sends anything. See
// lib/notifications/dispatch.ts for the seam where real delivery plugs in
// later. Every candidate is about discovery or TBR follow-through, never a
// streak (the user was explicit: the existing streak, D79, only tracks
// swipe/discovery activity, not reading completion, and nothing new should
// treat it as one).
const TBR_REMINDER_AFTER_DAYS = 3; // deliberately separate from lib/tbr.ts's
// 21-day STALE_AFTER_DAYS -- that one drives an in-app shelf badge, this is
// a different, notification-specific threshold.

export type NotificationCandidate = {
  kind: "tbr_reminder" | "weekly_drop_ready";
  title: string;
  body: string;
};

function windowKeyFor(frequency: "daily" | "weekly", timezone: string | null): string {
  return frequency === "daily" ? localDateString(timezone) : localWeekString(timezone);
}

async function alreadyNotifiedThisWindow(actor: Actor, windowKey: string): Promise<boolean> {
  const existing = await prisma.notificationLog.findFirst({
    where: { ...actorWhere(actor), windowKey },
    select: { id: true },
  });
  return existing !== null;
}

async function findTbrReminder(actor: Actor): Promise<NotificationCandidate | null> {
  const cutoff = new Date(Date.now() - TBR_REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const entry = await prisma.tBREntry.findFirst({
    where: { ...actorWhere(actor), status: TbrStatus.to_read, updatedAt: { lte: cutoff } },
    orderBy: { updatedAt: "asc" },
    select: { book: { select: { title: true } } },
  });
  if (!entry) return null;
  return {
    kind: "tbr_reminder",
    title: "Still on your shelf",
    body: `You added "${entry.book.title}" to your TBR a few days ago — have you checked it out?`,
  };
}

async function findWeeklyDropReady(actor: Actor, weekKey: string): Promise<NotificationCandidate | null> {
  // WeeklyPick (D75) is accounts-only -- same restriction as /weekly itself.
  if (actor.kind !== "user") return null;
  // Checked independently of getNotificationCandidate's overall per-window
  // cap: with frequency=daily, the general cap resets every day, but this
  // candidate shouldn't re-fire every day of the same week once it's
  // already been suggested once -- so it tracks its own week-scoped
  // "already nudged" state on top of the outer daily/weekly cap.
  const alreadyNudgedThisWeek = await prisma.notificationLog.findFirst({
    where: { ...actorWhere(actor), kind: "weekly_drop_ready", windowKey: weekKey },
    select: { id: true },
  });
  if (alreadyNudgedThisWeek) return null;
  return {
    kind: "weekly_drop_ready",
    title: "This week's picks are ready",
    body: "Your Super Match plus this week's drop are ready to discover.",
  };
}

// Priority order: TBR follow-through first (per the user's explicit focus),
// then a discovery nudge. Returns null if notifications are off, or if this
// actor has already been notified within the current frequency window, or
// if nothing qualifies.
export async function getNotificationCandidate(actor: Actor): Promise<NotificationCandidate | null> {
  const preference = await getPreferenceForActor(actor);
  if (!preference || preference.notificationFrequency === "off") return null;

  const frequency = preference.notificationFrequency;
  const windowKey = windowKeyFor(frequency, preference.timezone);
  if (await alreadyNotifiedThisWindow(actor, windowKey)) return null;

  return (await findTbrReminder(actor)) ?? (await findWeeklyDropReady(actor, localWeekString(preference.timezone)));
}
