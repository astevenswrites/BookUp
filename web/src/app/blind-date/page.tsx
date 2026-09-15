import { redirect } from "next/navigation";
import { BlindDateClient } from "@/components/BlindDateClient";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";

// D48: same gate as the main deck — Blind Date needs a Preference (quiz
// completed) to know the hard content-warning filter, even for the
// algorithmic "Surprise Me" pick.
export default async function BlindDatePage() {
  const actor = await getActor();
  const preference = hasIdentity(actor) ? await getPreferenceForActor(actor) : null;
  if (!preference) redirect("/quiz");

  return <BlindDateClient />;
}
