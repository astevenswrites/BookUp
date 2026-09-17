import Link from "next/link";
import { Landing } from "@/components/Landing";
import { Home } from "@/components/Home";
import { getActor } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";
import { getTagsByCategory } from "@/lib/tags";
import { DAILY_SWIPE_CAP, getTbrCount, getTodaySwipeCount } from "@/lib/limits";
import { displayedStreak } from "@/lib/streaks";
import { getActiveChallenges } from "@/lib/challenges";
import { localDateString } from "@/lib/dailyPicks";

// D62: `/` depends only on sign-in status now, not on whether a preference
// exists — a real account always gets the dashboard (or, if signed up but
// hasn't taken the quiz yet, a simple prompt to do so), and anyone not
// signed in always sees the marketing Landing page, even an anonymous
// session mid-preview with its own preference already set. That anonymous
// preview flow still reaches `/swipe` directly, via the quiz's own
// post-submit redirect (D61) — it just never routes back through `/`
// itself, so clicking "Home" mid-preview intentionally shows Landing, not
// the deck.
export default async function HomePage() {
  const actor = await getActor();

  if (actor.kind !== "user") {
    return <Landing />;
  }

  const preference = await getPreferenceForActor(actor);
  if (!preference) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="font-serif text-2xl text-on-vibe">Welcome back</h1>
        <p className="mt-2 text-sm text-on-vibe-muted">
          Take the quiz to get your first matches.
        </p>
        <Link
          href="/quiz"
          className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground"
        >
          Take the quiz
        </Link>
      </div>
    );
  }

  const { mood: moods } = await getTagsByCategory();
  const [tbrCount, swipedToday] = await Promise.all([
    getTbrCount(actor),
    getTodaySwipeCount(actor),
  ]);
  const remainingToday = Math.max(0, DAILY_SWIPE_CAP - swipedToday);
  const streak = displayedStreak(preference.currentStreak, preference.lastActiveDate, preference.timezone);
  const activeChallenge = getActiveChallenges(localDateString(preference.timezone))[0] ?? null;

  return (
    <Home
      moods={moods}
      currentMoodTagId={preference.currentMoodTagId}
      tbrCount={tbrCount}
      remainingToday={remainingToday}
      streak={streak}
      activeChallenge={activeChallenge}
    />
  );
}
