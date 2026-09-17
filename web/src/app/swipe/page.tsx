import Link from "next/link";
import { redirect } from "next/navigation";
import { SwipeDeck } from "@/components/SwipeDeck";
import { SignUpWall } from "@/components/SignUpWall";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";
import { getDeckForPreference } from "@/lib/matching";
import {
  ANONYMOUS_PREVIEW_SWIPE_CAP,
  DAILY_SWIPE_CAP,
  getExcludedBookIds,
  getTbrCount,
  getTodaySwipeCount,
  getTotalSwipeCount,
} from "@/lib/limits";

// D61: split out of `/` — this is the actual swipe deck now. `/` is either
// the marketing landing page (no preference yet) or the signed-in home
// dashboard (Home.tsx) that links here via "Start swiping". See D22-D28/D41
// for the deck's original history and D61 for why it moved off `/`.
// D42: an anonymous session (no account yet) gets a small one-time preview
// of real matching, then a signup wall — not the recurring daily cap below,
// which only applies once signed in.
export default async function SwipePage() {
  const actor = await getActor();
  const preference = hasIdentity(actor) ? await getPreferenceForActor(actor) : null;

  if (!preference || !hasIdentity(actor)) {
    redirect("/");
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

  const excludeBookIds = await getExcludedBookIds(actor);
  const { books: deck, tagWeights, collaborativeBoosts } = await getDeckForPreference(
    actor,
    preference,
    excludeBookIds,
    30
  );
  const initialTbrCount = await getTbrCount(actor);

  return (
    <div className="flex flex-1 flex-col pt-16">
      <SwipeDeck
        key={preference.currentMoodTagId ?? "auto"}
        initialDeck={deck}
        remainingToday={remainingToday}
        displayMode={preference.displayMode}
        tagWeights={tagWeights}
        collaborativeBoosts={collaborativeBoosts}
        currentMoodTagId={preference.currentMoodTagId}
        isAnonymous={actor.kind === "session"}
        initialTbrCount={initialTbrCount}
      />
    </div>
  );
}
