import { prisma } from "@/lib/prisma";
import { actorWhere, type Actor } from "@/lib/actor";
import { localDateString } from "@/lib/dailyPicks";
import { localWeekString } from "@/lib/weeklyPicks";
import { getPreferenceForActor } from "@/lib/preferences";
import type { NotificationCandidate } from "@/lib/notifications";

// D86: the seam where real delivery (email/push) plugs in later without
// touching getNotificationCandidate's decision logic at all. No cron or
// route calls this yet -- structure-prep only, per the user's explicit call.
export interface NotificationChannel {
  send(candidate: NotificationCandidate, actor: Actor): Promise<void>;
}

// The only implementation for now. Doesn't actually deliver anything --
// just logs what would be sent and records the NotificationLog row, so the
// once-a-window cap in getNotificationCandidate is exercised for real
// against a live table, not just designed on paper. A future
// ResendNotificationChannel/WebPushNotificationChannel implements the same
// interface and replaces this one call site.
export class LoggingNotificationChannel implements NotificationChannel {
  async send(candidate: NotificationCandidate, actor: Actor): Promise<void> {
    const preference = await getPreferenceForActor(actor);
    const frequency = preference?.notificationFrequency ?? "off";
    const windowKey =
      frequency === "weekly"
        ? localWeekString(preference?.timezone ?? null)
        : localDateString(preference?.timezone ?? null);

    console.log(`[notification:${candidate.kind}] ${candidate.title} -- ${candidate.body}`);

    await prisma.notificationLog.create({
      data: { kind: candidate.kind, windowKey, ...actorWhere(actor) },
    });
  }
}
