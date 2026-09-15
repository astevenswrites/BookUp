import { redirect } from "next/navigation";
import { Landing } from "@/components/Landing";
import { Home } from "@/components/Home";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";
import { getTagsByCategory } from "@/lib/tags";
import { DAILY_SWIPE_CAP, getTbrCount, getTodaySwipeCount } from "@/lib/limits";

// D61: `/` is the signed-in home dashboard — shelf, profile, blind date,
// trending, the mood picker, and a "Start swiping" link into `/swipe`
// (which used to live here — see DECISIONS.md D61 for why it moved). A
// first-time/no-preference visitor still sees the marketing Landing page.
// An anonymous session that's already taken the quiz skips this dashboard
// entirely and goes straight to `/swipe` — the whole point of the preview
// funnel (D42) is getting them into real matching fast, not a menu of
// features an account-less session can't fully use anyway.
export default async function HomePage() {
  const actor = await getActor();
  const preference = hasIdentity(actor) ? await getPreferenceForActor(actor) : null;

  if (!preference || !hasIdentity(actor)) {
    return <Landing />;
  }

  if (actor.kind === "session") {
    redirect("/swipe");
  }

  const { mood: moods } = await getTagsByCategory();
  const [tbrCount, swipedToday] = await Promise.all([
    getTbrCount(actor),
    getTodaySwipeCount(actor),
  ]);
  const remainingToday = Math.max(0, DAILY_SWIPE_CAP - swipedToday);

  return (
    <Home
      moods={moods}
      currentMoodTagId={preference.currentMoodTagId}
      tbrCount={tbrCount}
      remainingToday={remainingToday}
    />
  );
}
