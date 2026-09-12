"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateActor, actorWhere } from "@/lib/actor";
import { getDeckForPreference } from "@/lib/matching";
import { getPreferenceForActor } from "@/lib/preferences";
import { getSwipedBookIds } from "@/lib/limits";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { completeSignIn } from "@/lib/auth";
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

export async function swipeBook(bookId: string, direction: "left" | "right") {
  const actor = await getOrCreateActor();

  await prisma.swipe.create({ data: { bookId, direction, ...actorWhere(actor) } });

  if (direction === "right") {
    const existing = await prisma.tBREntry.findFirst({
      where: { bookId, ...actorWhere(actor) },
    });
    if (!existing) {
      await prisma.tBREntry.create({ data: { bookId, ...actorWhere(actor) } });
    }
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

export async function getMoreCards(excludeBookIds: string[], limit = 20) {
  const actor = await getOrCreateActor();
  const preference = await getPreferenceForActor(actor);
  if (!preference) return [];

  const alreadySwiped = await getSwipedBookIds(actor);
  const exclude = [...new Set([...excludeBookIds, ...alreadySwiped])];

  return getDeckForPreference(preference, exclude, limit);
}

// --- TBR shelf management (D36: statuses + the 21-day "still interested?" re-prompt) ---

export async function updateTbrStatus(entryId: string, status: TbrStatus) {
  const actor = await getOrCreateActor();
  await prisma.tBREntry.updateMany({
    where: { id: entryId, ...actorWhere(actor) },
    data: { status },
  });
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
  const origin = (await headers()).get("origin");

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
