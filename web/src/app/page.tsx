import Link from "next/link";
import { Quiz } from "@/components/Quiz";
import { SwipeDeck } from "@/components/SwipeDeck";
import { getSessionId } from "@/lib/session";
import { getPreferenceForSession } from "@/lib/preferences";
import { getTagsByCategory } from "@/lib/tags";
import { getDeckForPreference } from "@/lib/matching";
import { DAILY_SWIPE_CAP, getSwipedBookIds, getTodaySwipeCount } from "@/lib/limits";

// The real product loop (D27): quiz for new sessions, swipe deck once a
// Preference exists. See DECISIONS.md D22-D28 for the decisions behind this.
export default async function Home() {
  const sessionId = await getSessionId();
  const preference = sessionId ? await getPreferenceForSession(sessionId) : null;

  if (!preference) {
    const tags = await getTagsByCategory();
    return <Quiz tags={tags} />;
  }

  const swipedToday = await getTodaySwipeCount(sessionId!);
  const remainingToday = DAILY_SWIPE_CAP - swipedToday;

  if (remainingToday <= 0) {
    return (
      <div className="mx-auto flex w-full min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="font-serif text-2xl text-foreground">
          That&apos;s today&apos;s matches!
        </h2>
        <p className="mt-2 text-sm text-muted">
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

  const excludeBookIds = await getSwipedBookIds(sessionId!);
  const deck = await getDeckForPreference(preference, excludeBookIds, 30);

  return (
    <SwipeDeck
      initialDeck={deck}
      remainingToday={remainingToday}
      displayMode={preference.displayMode}
    />
  );
}
