import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { getBooks } from "@/lib/books";

// Public-facing catalog preview, linked from the landing page's "Peek at
// the deck" button (D66/D70) — originally a Phase 0 internal design-QA grid
// (D27), repurposed now that the catalog has real, tagged books worth
// showing off before someone commits to signing up.
export default async function ReviewPage() {
  const books = await getBooks();

  return (
    <div className="flex-1 px-4 pb-10 pt-20 sm:px-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <h1 className="font-serif text-3xl text-on-vibe">
          Peek at the deck
        </h1>
        <p className="mt-1 text-sm text-on-vibe-muted">
          {books.length} books from our catalog — well-known favorites,
          recent hits, and a sample across genres, each tagged with the
          tropes, moods, and vibes we match on. Want picks made just for you?
          Head to the{" "}
          <Link href="/" className="underline">
            home page
          </Link>{" "}
          and sign up.
        </p>
      </header>
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {books.map((book) => (
          <BookCard key={book.id} book={book} detailsLocked />
        ))}
      </main>
    </div>
  );
}
