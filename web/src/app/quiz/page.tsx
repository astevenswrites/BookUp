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

  // Already has a preference — nothing to do here, back to swiping.
  if (preference) redirect("/");

  const tags = await getTagsByCategory();
  return <Quiz tags={tags} redirectTo="/" />;
}
