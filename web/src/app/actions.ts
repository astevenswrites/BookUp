"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateActor, actorWhere } from "@/lib/actor";
import { setDemoTheme } from "@/lib/session";
import { getDeckForPreference } from "@/lib/matching";
import { getTangentialPick, getCommunityPick } from "@/lib/blindDate";
import { getPreferenceForActor } from "@/lib/preferences";
import { getSwipedBookIds } from "@/lib/limits";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { completeSignIn } from "@/lib/auth";
import { getSiteOrigin } from "@/lib/site";
import { HeatLevel, Pacing, ReadingFrequency, DisplayMode, VibeTheme, TbrStatus } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

function asEnumOrNull<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[]
): T | null {
  const str = typeof value === "string" ? value : null;
  return str && (allowed as readonly string[]).includes(str) ? (str as T) : null;
}

export async function submitQuiz(formData: FormData) {
  const actor = await getOrCreateActor();

  const heatLevelMax = asEnumOrNull(
    formData.get("heatLevelMax"),
    Object.values(HeatLevel)
  );
  const pacing = asEnumOrNull(formData.get("pacing"), Object.values(Pacing));
  const readingFrequency = asEnumOrNull(
    formData.get("readingFrequency"),
    Object.values(ReadingFrequency)
  );
  const displayMode =
    asEnumOrNull(formData.get("displayMode"), Object.values(DisplayMode)) ??
    DisplayMode.cover_first;
  const favoriteBooksNoteRaw = formData.get("favoriteBooksNote");
  const favoriteBooksNote =
    typeof favoriteBooksNoteRaw === "string" && favoriteBooksNoteRaw.trim()
      ? favoriteBooksNoteRaw.trim().slice(0, 500)
      : null;
  const tagIds = formData.getAll("tagIds").filter((v): v is string => typeof v === "string");

  const data = { heatLevelMax, pacing, readingFrequency, displayMode, favoriteBooksNote };
  const preference =
    actor.kind === "user"
      ? await prisma.preference.upsert({
          where: { userId: actor.userId },
          update: data,
          create: { userId: actor.userId, ...data },
        })
      : await prisma.preference.upsert({
          where: { sessionId: actor.sessionId },
          update: data,
          create: { sessionId: actor.sessionId, ...data },
        });

  await prisma.preferenceTag.deleteMany({ where: { preferenceId: preference.id } });
  if (tagIds.length) {
    await prisma.preferenceTag.createMany({
      data: tagIds.map((tagId) => ({ preferenceId: preference.id, tagId })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/");
}

// D45: optional behavioral signal captured alongside the swipe itself —
// dwellMs (time-to-decision) and viewedDetails (blurb/content-warning
// expand before deciding) feed getImplicitTagWeights' confidence
// multiplier. Both are best-effort; omit either rather than guess.
export async function swipeBook(
  bookId: string,
  direction: "left" | "right",
  meta?: { dwellMs?: number; viewedDetails?: boolean }
) {
  const actor = await getOrCreateActor();

  await prisma.swipe.create({
    data: {
      bookId,
      direction,
      dwellMs: meta?.dwellMs,
      viewedDetails: meta?.viewedDetails ?? false,
      ...actorWhere(actor),
    },
  });

  if (direction === "right") {
    const existing = await prisma.tBREntry.findFirst({
      where: { bookId, ...actorWhere(actor) },
    });
    if (!existing) {
      await prisma.tBREntry.create({ data: { bookId, ...actorWhere(actor) } });
    }
  }
}

// D52: a safety net for the raised swipe-force thresholds — undoes the
// single most recent swipe on a book, not a general history/redo system.
// Deletes the Swipe row itself, and (for a right-swipe) the TBREntry it
// created — but only if that entry is still sitting untouched at `to_read`.
// If the reader has since done anything with it (started reading, marked
// finished/DNF), that's real progress an accidental-swipe undo must never
// silently erase, so it's left alone and only the swipe record is undone.
export async function undoLastSwipe(bookId: string) {
  const actor = await getOrCreateActor();

  const lastSwipe = await prisma.swipe.findFirst({
    where: { bookId, ...actorWhere(actor) },
    orderBy: { createdAt: "desc" },
  });
  if (!lastSwipe) return;

  await prisma.swipe.delete({ where: { id: lastSwipe.id } });

  if (lastSwipe.direction === "right") {
    await prisma.tBREntry.deleteMany({
      where: { bookId, status: TbrStatus.to_read, ...actorWhere(actor) },
    });
  }
}

// D33: null means "go back to auto-deriving the theme from my quiz moods"
export async function setThemeOverride(theme: VibeTheme | null) {
  const actor = await getOrCreateActor();
  const where =
    actor.kind === "user" ? { userId: actor.userId } : { sessionId: actor.sessionId };
  await prisma.preference.update({ where, data: { themeOverride: theme } });
  revalidatePath("/", "layout");
}

// D41 correction: the landing page's pre-quiz mood demo — a plain cookie,
// not Preference.themeOverride, so picking a color before taking the quiz
// can't accidentally make `!!preference` true and skip a first-time visitor
// past the landing page. See lib/session.ts's setDemoTheme for the full story.
export async function setDemoThemeOverride(theme: VibeTheme) {
  await setDemoTheme(theme);
  revalidatePath("/", "layout");
}

// D39: "what do you feel like reading today?" — sticky until manually
// changed/cleared (null), not reset per session.
export async function setCurrentMood(tagId: string | null) {
  const actor = await getOrCreateActor();
  const where =
    actor.kind === "user" ? { userId: actor.userId } : { sessionId: actor.sessionId };
  await prisma.preference.update({ where, data: { currentMoodTagId: tagId } });
  revalidatePath("/");
}

export async function getMoreCards(excludeBookIds: string[], limit = 20) {
  const actor = await getOrCreateActor();
  const preference = await getPreferenceForActor(actor);
  if (!preference) return { books: [], tagWeights: {}, collaborativeBoosts: {} };

  const alreadySwiped = await getSwipedBookIds(actor);
  const exclude = [...new Set([...excludeBookIds, ...alreadySwiped])];

  return getDeckForPreference(actor, preference, exclude, limit);
}

// --- Blind Date (D48: two separate entry points) ---

export async function getBlindDateSurprise() {
  const actor = await getOrCreateActor();
  const preference = await getPreferenceForActor(actor);
  if (!preference) return null;
  const excludeBookIds = await getSwipedBookIds(actor);
  return getTangentialPick(actor, preference, excludeBookIds);
}

export async function getBlindDateCommunityPick() {
  const actor = await getOrCreateActor();
  const preference = await getPreferenceForActor(actor);
  if (!preference) return { status: "insufficient_data" as const };
  const excludeBookIds = await getSwipedBookIds(actor);
  return getCommunityPick(actor, preference, excludeBookIds);
}

// --- TBR shelf management (D36: statuses + the 21-day "still interested?" re-prompt) ---

// D45: stamps startedAt/finishedAt the first time an entry transitions into
// `reading` / `finished`|`dnf` — the reading-completion signal the research
// doc calls highest-quality. Fetches first rather than a blind updateMany
// so a later re-transition (e.g. finished -> reading again) never clobbers
// an already-set timestamp.
export async function updateTbrStatus(entryId: string, status: TbrStatus) {
  const actor = await getOrCreateActor();
  const entry = await prisma.tBREntry.findFirst({
    where: { id: entryId, ...actorWhere(actor) },
  });
  if (!entry) return;

  const data: { status: TbrStatus; startedAt?: Date; finishedAt?: Date } = { status };
  if (status === TbrStatus.reading && !entry.startedAt) data.startedAt = new Date();
  if ((status === TbrStatus.finished || status === TbrStatus.dnf) && !entry.finishedAt) {
    data.finishedAt = new Date();
  }

  await prisma.tBREntry.update({ where: { id: entryId }, data });
  revalidatePath("/tbr");
}

export async function removeTbrEntry(entryId: string) {
  const actor = await getOrCreateActor();
  await prisma.tBREntry.deleteMany({ where: { id: entryId, ...actorWhere(actor) } });
  revalidatePath("/tbr");
}

// "Still interested?" dismissal — bumps updatedAt so the re-prompt clears
// for another 21 days without changing the entry's status.
export async function keepTbrEntry(entryId: string) {
  const actor = await getOrCreateActor();
  await prisma.tBREntry.updateMany({
    where: { id: entryId, ...actorWhere(actor) },
    data: { updatedAt: new Date() },
  });
  revalidatePath("/tbr");
}

// --- Today's Picks (D35) ---

export async function addPickToShelf(bookId: string) {
  const actor = await getOrCreateActor();
  const existing = await prisma.tBREntry.findFirst({ where: { bookId, ...actorWhere(actor) } });
  if (!existing) {
    await prisma.tBREntry.create({ data: { bookId, ...actorWhere(actor) } });
  }
  revalidatePath("/today");
  revalidatePath("/tbr");
}

// Called once client-side per session/device (TimezoneSync) so the Today's
// Picks reset lines up with the reader's own local midnight, not UTC.
// updateMany (not update) so this silently no-ops before a Preference
// exists yet (pre-quiz) instead of throwing.
export async function setTimezone(timezone: string) {
  const actor = await getOrCreateActor();
  const where =
    actor.kind === "user" ? { userId: actor.userId } : { sessionId: actor.sessionId };
  await prisma.preference.updateMany({ where, data: { timezone } });
}

// --- Auth (D34: email/password + Google OAuth) ---

function authErrorRedirect(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createServerSupabaseClient();
  // D57: not header-derived — see lib/site.ts for why the raw Origin header
  // isn't trustworthy input for a link Supabase emails out.
  const origin = getSiteOrigin(await headers());

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) authErrorRedirect(error.message);

  if (!data.session) {
    // Email confirmation is required by the Supabase project's auth
    // settings — no session yet, nothing to merge until they confirm.
    redirect("/login?check_email=1");
  }

  await completeSignIn(data.user!);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) authErrorRedirect(error.message);

  await completeSignIn(data.user);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
