import { redirect } from "next/navigation";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";
import { getAlreadyReadAuthorCandidates } from "@/lib/alreadyRead";
import { AlreadyReadFlow } from "@/components/AlreadyReadFlow";

const AUTHOR_COUNT = 20;

// D81: reached right after the quiz (Quiz's redirectTo, quiz/page.tsx) —
// before the deck, not after. Doing this after someone's already started
// swiping would mean some of these already-read books had a real chance to
// show up (and cost a swipe) in the meantime.
//
// Author-first, not book-first (follow-up the same day): picking authors
// you read, then narrowing to specific titles, scales much better for a
// reader whose backlist is concentrated in a handful of favorites than
// scanning book covers one at a time — "have you read Stephen King" can
// stand in for a dozen book-level decisions at once.
export default async function AlreadyReadPage() {
  const actor = await getActor();
  if (!hasIdentity(actor)) redirect("/quiz");

  const preference = await getPreferenceForActor(actor);
  if (!preference) redirect("/quiz");

  const authors = await getAlreadyReadAuthorCandidates(actor, preference, AUTHOR_COUNT);

  // Nothing to ask about (a very new/thin catalog corner) — straight to
  // the deck rather than an empty picker with nothing to click.
  if (authors.length === 0) redirect("/swipe");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-20 sm:px-8">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-on-vibe">Read any of these authors already?</h1>
        <p className="mt-1 text-sm text-on-vibe-muted">
          Pick any you&apos;ve read, then we&apos;ll narrow it down to the specific books — so
          we don&apos;t waste your swipes on ones you&apos;ve already been through.
        </p>
      </header>
      <AlreadyReadFlow authors={authors} />
    </div>
  );
}
