import { prisma } from "@/lib/prisma";
import { TbrStatus } from "@/generated/prisma/enums";

// Runs once, right after a successful sign-in/sign-up, while the anonymous
// `bd_session` cookie from before login still points at real data. Folds
// that anonymous activity into the new/existing account so nothing is lost
// just because someone swiped a few books before creating an account
// (D3/D22's whole point — auth is only needed to persist it).
export async function mergeAnonymousSessionIntoUser(userId: string, sessionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.swipe.updateMany({
      where: { sessionId, userId: null },
      data: { userId, sessionId: null },
    });

    const anonEntries = await tx.tBREntry.findMany({ where: { sessionId, userId: null } });
    const statusRank: Record<TbrStatus, number> = {
      to_read: 0,
      reading: 1,
      finished: 2,
      dnf: 2,
    };
    for (const entry of anonEntries) {
      const existing = await tx.tBREntry.findFirst({ where: { bookId: entry.bookId, userId } });
      if (existing) {
        // Already on the account's shelf — keep it, drop the anonymous
        // duplicate, but don't lose more advanced progress either side had.
        if (statusRank[entry.status] > statusRank[existing.status]) {
          await tx.tBREntry.update({ where: { id: existing.id }, data: { status: entry.status } });
        }
        await tx.tBREntry.delete({ where: { id: entry.id } });
      } else {
        await tx.tBREntry.update({
          where: { id: entry.id },
          data: { userId, sessionId: null },
        });
      }
    }

    const [userPref, anonPref] = await Promise.all([
      tx.preference.findUnique({ where: { userId } }),
      tx.preference.findUnique({ where: { sessionId } }),
    ]);
    if (anonPref && !userPref) {
      await tx.preference.update({ where: { id: anonPref.id }, data: { userId, sessionId: null } });
    } else if (anonPref && userPref) {
      // Account already has quiz answers — keep those, discard the
      // anonymous session's (usually a re-take under a fresh cookie).
      await tx.preferenceTag.deleteMany({ where: { preferenceId: anonPref.id } });
      await tx.preference.delete({ where: { id: anonPref.id } });
    }
  });
}
