import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { getBooks } from "@/lib/books";

// Phase 0 review grid — moved off `/` in Phase 1 (D27). Kept for design QA,
// not part of the product itself.
export default async function ReviewPage() {
  const books = await getBooks();

  return (
    <div className="flex-1 bg-background px-4 py-10 sm:px-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <h1 className="font-serif text-3xl text-foreground">
          Book card review
        </h1>
        <p className="mt-1 text-sm text-muted">
          {books.length} synthetic placeholder books, for reviewing the card
          design across variety. Internal design QA only — the real product
          loop is at{" "}
          <Link href="/" className="underline">
            /
          </Link>
          .
        </p>
      </header>
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </main>
    </div>
  );
}
