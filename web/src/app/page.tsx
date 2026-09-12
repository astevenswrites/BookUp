import Link from "next/link";
import { Landing } from "@/components/Landing";
import { SwipeDeck } from "@/components/SwipeDeck";
import { MoodQuickSelect } from "@/components/MoodQuickSelect";
import { SignUpWall } from "@/components/SignUpWall";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";
import { getTagsByCategory } from "@/lib/tags";
import { getDeckForPreference } from "@/lib/matching";
import {
  ANONYMOUS_PREVIEW_SWIPE_CAP,
  DAILY_SWIPE_CAP,
  getSwipedBookIds,
  getTbrCount,
  getTodaySwipeCount,
  getTotalSwipeCount,
} from "@/lib/limits";

// D41: `/` is the marketing landing page for a first-time/no-preference
// visitor; the quiz moved to /quiz. Once a Preference exists, `/` is the
// real product loop (D27) — swipe deck. See DECISIONS.md D22-D28/D41.
// D42: an anonymous session (no account yet) gets a small one-time preview
// of real matching, then a signup wall — not the recurring daily cap below,
// which only applies once signed in.
export default async function Home() {
  const actor = await getActor();
  const preference = hasIdentity(actor) ? await getPreferenceForActor(actor) : null;

  if (!preference || !hasIdentity(actor)) {
    return <Landing />;
  }

  let remainingToday: number;
  if (actor.kind === "session") {
    const totalSwipes = await getTotalSwipeCount(actor);
    remainingToday = ANONYMOUS_PREVIEW_SWIPE_CAP - totalSwipes;
    if (remainingToday <= 0) {
      const matchCount = await getTbrCount(actor);
      return <SignUpWall matchCount={matchCount} />;
    }
  } else {
    const swipedToday = await getTodaySwipeCount(actor);
    remainingToday = DAILY_SWIPE_CAP - swipedToday;
    if (remainingToday <= 0) {
      return (
        <div className="mx-auto flex w-full min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
          <h2 className="font-serif text-2xl text-on-vibe">
            That&apos;s today&apos;s matches!
          </h2>
          <p className="mt-2 text-sm text-on-vibe-muted">
            Come back tomorrow for {DAILY_SWIPE_CAP} more.
          </p>
          <Link
            href="/tbr"
            className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground"
          >
            View your shelf
          </Link>
        </div>
      );
    }
  }

  const excludeBookIds = await getSwipedBookIds(actor);
  const deck = await getDeckForPreference(preference, excludeBookIds, 30);
  const { mood: moods } = await getTagsByCategory();
  const likedTagIds = preference.tags
    .filter(({ tag }) => tag.category !== "content_warning")
    .map(({ tagId }) => tagId);

  return (
    <div className="flex flex-1 flex-col pt-16">
      <MoodQuickSelect moods={moods} currentMoodTagId={preference.currentMoodTagId} />
      <SwipeDeck
        key={preference.currentMoodTagId ?? "auto"}
        initialDeck={deck}
        remainingToday={remainingToday}
        displayMode={preference.displayMode}
        likedTagIds={likedTagIds}
        currentMoodTagId={preference.currentMoodTagId}
        isAnonymous={actor.kind === "session"}
      />
    </div>
  );
}
