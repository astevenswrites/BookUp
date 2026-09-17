import Link from "next/link";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";
import { getWeeklyDrop, WEEKLY_DROP_COUNT, SUPER_MATCH_RANK } from "@/lib/weeklyPicks";
import { TodaysPickCard } from "@/components/TodaysPickCard";

// D75: accounts-only, same reasoning as Today's Picks (D35) — a persistent
// weekly set only makes sense tied to something that outlives a browser
// session.
export default async function WeeklyPage() {
  const actor = await getActor();

  if (!hasIdentity(actor) || actor.kind !== "user") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="font-serif text-2xl text-on-vibe">This Week&apos;s Picks is for accounts</h1>
        <p className="mt-2 text-sm text-on-vibe-muted">
          Sign in to get a Super Match plus a bigger weekly drop, every week.
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
          We need to know your vibe before we can curate a weekly drop.
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

  const ranked = await getWeeklyDrop(actor, preference);
  // D83: identify the Super Match by its actual persisted `rank`, not by
  // array position — a cascade delete (WeeklyPick.book: onDelete Cascade)
  // can remove the true rank-0 row out from under an already-generated
  // set, which would silently mislabel array[0] as the Super Match even
  // though it was really rank 1. Falls back to whichever rank is lowest
  // if rank 0 itself is gone, rather than crashing on an empty find.
  const superMatchEntry =
    ranked.find((p) => p.rank === SUPER_MATCH_RANK) ??
    [...ranked].sort((a, b) => a.rank - b.rank)[0];
  const superMatch = superMatchEntry?.book;
  const restOfDrop = ranked.filter((p) => p !== superMatchEntry).map((p) => p.book);
  const picks = ranked.map((p) => p.book);

  return (
    <div className="flex-1 px-4 pb-10 pt-20 sm:px-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <h1 className="font-serif text-3xl text-on-vibe">This week&apos;s picks</h1>
        <p className="mt-1 text-sm text-on-vibe-muted">
          {picks.length === 0
            ? "A fresh set every Monday."
            : `Your Super Match, plus ${restOfDrop.length} more — a fresh set of ${WEEKLY_DROP_COUNT} every Monday.`}
        </p>
        <Link href="/swipe" className="mt-2 inline-block text-sm text-on-vibe-accent underline">
          Back to swiping
        </Link>
      </header>

      {picks.length === 0 ? (
        <p className="mx-auto max-w-6xl text-sm text-on-vibe-muted">
          You&apos;ve already seen everything that matches well right now — check back after
          swiping a bit more.
        </p>
      ) : (
        <main className="mx-auto flex max-w-6xl flex-col gap-10">
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-on-vibe-accent">
              ⭐ This week&apos;s Super Match
            </p>
            <div className="max-w-sm rounded-3xl border-2 border-accent bg-accent/5 p-3">
              <TodaysPickCard book={superMatch} />
            </div>
          </section>

          {restOfDrop.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-on-vibe-muted">
                The rest of this week&apos;s drop
              </p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {restOfDrop.map((book) => (
                  <TodaysPickCard key={book.id} book={book} />
                ))}
              </div>
            </section>
          )}
        </main>
      )}
    </div>
  );
}
