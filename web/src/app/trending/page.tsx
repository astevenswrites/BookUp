import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor } from "@/lib/preferences";
import { getExcludedBookIds } from "@/lib/limits";
import { getTrendingBooks } from "@/lib/trending";

// D50: community-wide popularity, deliberately independent of personal fit
// — separate from Blind Date's Community Pick (which requires the picker to
// resemble the reader's own taste). Same gate as the rest of the product
// (needs a Preference for the content-warning filter), same honest-empty
// pattern as Blind Date/D48 when there isn't enough cross-reader data yet.
export default async function TrendingPage() {
  const actor = await getActor();
  const preference = hasIdentity(actor) ? await getPreferenceForActor(actor) : null;

  if (!preference || !hasIdentity(actor)) {
    return (
      <div className="mx-auto flex w-full min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="font-serif text-2xl text-on-vibe">Trending</h1>
        <p className="mt-2 text-sm text-on-vibe-muted">
          Take the quiz first so we know what to filter out for you.
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

  const excludeBookIds = await getExcludedBookIds(actor);
  const books = await getTrendingBooks(actor, preference, excludeBookIds);

  return (
    <div className="flex-1 px-4 pb-10 pt-20 sm:px-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <h1 className="font-serif text-3xl text-on-vibe">Trending</h1>
        <p className="mt-1 text-sm text-on-vibe-muted">
          What every reader&apos;s adding right now — not filtered to your taste.
        </p>
        <Link href="/swipe" className="mt-2 inline-block text-sm text-on-vibe-accent underline">
          Back to swiping
        </Link>
      </header>
      {books.length === 0 ? (
        <p className="mx-auto max-w-6xl text-sm text-on-vibe-muted">
          Trending needs a few more readers before a real ranking is possible — check back soon.
        </p>
      ) : (
        <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book, i) => (
            <div key={book.id} className="relative">
              <span className="absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground shadow-sm">
                {i + 1}
              </span>
              <BookCard book={book} />
            </div>
          ))}
        </main>
      )}
    </div>
  );
}
