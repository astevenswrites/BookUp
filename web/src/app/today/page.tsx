import Link from "next/link";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";
import { getTodaysPicks, TODAYS_PICKS_COUNT } from "@/lib/dailyPicks";
import { TodaysPickCard } from "@/components/TodaysPickCard";

// D35: gated to accounts, not anonymous sessions — the roadmap frames this
// as an accounts-retention feature ("give people a reason to come back
// tomorrow"), and a persistent daily set only makes sense once it's tied to
// something that outlives a browser session.
export default async function TodaysPicksPage() {
  const actor = await getActor();

  if (!hasIdentity(actor) || actor.kind !== "user") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="font-serif text-2xl text-on-vibe">Today&apos;s Picks is for accounts</h1>
        <p className="mt-2 text-sm text-on-vibe-muted">
          Sign in to get a fresh, curated set of {TODAYS_PICKS_COUNT} books every day.
        </p>
        <Link
          href="/login"
          className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const preference = await getPreferenceForActor(actor);
  if (!preference) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="font-serif text-2xl text-on-vibe">Take the quiz first</h1>
        <p className="mt-2 text-sm text-on-vibe-muted">
          We need to know your vibe before we can curate picks.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground"
        >
          Take the quiz
        </Link>
      </div>
    );
  }

  const picks = await getTodaysPicks(actor, preference);

  return (
    <div className="flex-1 px-4 py-10 sm:px-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <h1 className="font-serif text-3xl text-on-vibe">Today&apos;s picks</h1>
        <p className="mt-1 text-sm text-on-vibe-muted">
          {picks.length} hand-matched book{picks.length === 1 ? "" : "s"} — a fresh set tomorrow.
        </p>
        <Link href="/" className="mt-2 inline-block text-sm text-on-vibe-link underline">
          Back to swiping
        </Link>
      </header>
      {picks.length === 0 ? (
        <p className="mx-auto max-w-6xl text-sm text-on-vibe-muted">
          You&apos;ve already seen everything that matches well right now — check back after
          swiping a bit more.
        </p>
      ) : (
        <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {picks.map((book) => (
            <TodaysPickCard key={book.id} book={book} />
          ))}
        </main>
      )}
    </div>
  );
}
