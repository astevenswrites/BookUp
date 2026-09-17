import { redirect } from "next/navigation";
import { Quiz } from "@/components/Quiz";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";
import { getTagsByCategory } from "@/lib/tags";

// Split out of `/` (D41) so `/` can be the marketing landing page — the
// quiz itself is unchanged from D22-D28, just reachable at its own route
// now instead of being what `/` shows for a no-preference visitor.
export default async function QuizPage() {
  const actor = await getActor();
  const preference = hasIdentity(actor) ? await getPreferenceForActor(actor) : null;

  // Already has a preference — nothing to do here. D62: `/` shows Landing
  // for anyone not signed in, so an anonymous session bounces to `/swipe`
  // (their deck) instead of a marketing page; a real account goes to the
  // dashboard at `/`.
  if (preference) redirect(actor.kind === "user" ? "/" : "/swipe");

  const tags = await getTagsByCategory();
  // D61: finishing the quiz should feel like arriving somewhere, not
  // another menu — still true, but D81 inserts one more real step first:
  // a chance to mark books already read elsewhere so they don't waste
  // swipes. already-read/page.tsx itself sends both "Skip" and "Continue"
  // on to /swipe, so the deck is still where this always ends up.
  return <Quiz tags={tags} redirectTo="/already-read" />;
}
