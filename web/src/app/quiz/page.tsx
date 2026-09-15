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

  // Already has a preference — nothing to do here, back to the dashboard.
  if (preference) redirect("/");

  const tags = await getTagsByCategory();
  // D61: straight into the deck on completion, not the dashboard — finishing
  // the quiz should feel like arriving somewhere, not another menu.
  return <Quiz tags={tags} redirectTo="/swipe" />;
}
