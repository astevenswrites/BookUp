import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";
import { getExcludedBookIds } from "@/lib/limits";
import { localDateString } from "@/lib/dailyPicks";
import { getActiveChallenges, getChallengeBooks, getChallengeProgress } from "@/lib/challenges";

// D86: discovery-first, same access pattern as /trending — works for
// anonymous and signed-in sessions alike (hasIdentity just means "has taken
// the quiz"), since discovery shouldn't be gated behind an account when the
// rest of the app's discovery surfaces aren't. Only ever linked to from the
// home page teaser when a challenge is actually active (see Home.tsx).
export default async function ChallengesPage() {
  const actor = await getActor();
  const preference = hasIdentity(actor) ? await getPreferenceForActor(actor) : null;

  if (!preference || !hasIdentity(actor)) {
    return (
      <div className="mx-auto flex w-full min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="font-serif text-2xl text-on-vibe">Reading Challenges</h1>
        <p className="mt-2 text-sm text-on-vibe-muted">
          Take the quiz first so we know what to pick for you.
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

  const today = localDateString(preference.timezone);
  const challenge = getActiveChallenges(today)[0];

  if (!challenge) {
    return (
      <div className="mx-auto flex w-full min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="font-serif text-2xl text-on-vibe">Reading Challenges</h1>
        <p className="mt-2 text-sm text-on-vibe-muted">
          No challenge running right now — check back soon.
        </p>
        <Link href="/swipe" className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground">
          Back to swiping
        </Link>
      </div>
    );
  }

  const excludeBookIds = await getExcludedBookIds(actor);
  const [{ books }, progress] = await Promise.all([
    getChallengeBooks(actor, preference, challenge, excludeBookIds),
    getChallengeProgress(actor, challenge),
  ]);

  return (
    <div className="flex-1 px-4 pb-10 pt-20 sm:px-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <h1 className="font-serif text-3xl text-on-vibe">
          {challenge.emoji} {challenge.label}
        </h1>
        <p className="mt-1 text-sm text-on-vibe-muted">
          {challenge.genreLabel} books picked for you, through{" "}
          {new Date(`${challenge.endDate}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}.
        </p>
        <p className="mt-2 text-xs text-on-vibe-muted">
          You&apos;ve finished {progress.completed} of {challenge.target} so far — every one counts.
        </p>
        <Link href="/swipe" className="mt-2 inline-block text-sm text-on-vibe-accent underline">
          Back to swiping
        </Link>
      </header>
      {books.length === 0 ? (
        <p className="mx-auto max-w-6xl text-sm text-on-vibe-muted">
          You&apos;ve already seen everything that matches well right now — check back after
          swiping a bit more.
        </p>
      ) : (
        <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </main>
      )}
    </div>
  );
}
