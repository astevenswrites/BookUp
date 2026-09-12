"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateSessionId } from "@/lib/session";
import { getDeckForPreference } from "@/lib/matching";
import { getPreferenceForSession } from "@/lib/preferences";
import { getSwipedBookIds } from "@/lib/limits";
import { HeatLevel, Pacing, ReadingFrequency, DisplayMode, VibeTheme } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

function asEnumOrNull<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[]
): T | null {
  const str = typeof value === "string" ? value : null;
  return str && (allowed as readonly string[]).includes(str) ? (str as T) : null;
}

export async function submitQuiz(formData: FormData) {
  const sessionId = await getOrCreateSessionId();

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

  const preference = await prisma.preference.upsert({
    where: { sessionId },
    update: { heatLevelMax, pacing, readingFrequency, displayMode, favoriteBooksNote },
    create: {
      sessionId,
      heatLevelMax,
      pacing,
      readingFrequency,
      displayMode,
      favoriteBooksNote,
    },
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
  const sessionId = await getOrCreateSessionId();

  await prisma.swipe.create({ data: { bookId, direction, sessionId } });

  if (direction === "right") {
    const existing = await prisma.tBREntry.findFirst({
      where: { bookId, sessionId, userId: null },
    });
    if (!existing) {
      await prisma.tBREntry.create({ data: { bookId, sessionId } });
    }
  }
}

// D33: null means "go back to auto-deriving the theme from my quiz moods"
export async function setThemeOverride(theme: VibeTheme | null) {
  const sessionId = await getOrCreateSessionId();
  await prisma.preference.update({
    where: { sessionId },
    data: { themeOverride: theme },
  });
  revalidatePath("/", "layout");
}

export async function getMoreCards(excludeBookIds: string[], limit = 20) {
  const sessionId = await getOrCreateSessionId();
  const preference = await getPreferenceForSession(sessionId);
  if (!preference) return [];

  const alreadySwiped = await getSwipedBookIds(sessionId);
  const exclude = [...new Set([...excludeBookIds, ...alreadySwiped])];

  return getDeckForPreference(preference, exclude, limit);
}
