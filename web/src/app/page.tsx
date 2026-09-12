import { BookCard } from "@/components/BookCard";
import { getBooks } from "@/lib/books";

// Phase 0 review grid — not the swipe stack (that's Phase 1). See DECISIONS.md D12.
export default async function Home() {
  const books = await getBooks();

  return (
    <div className="flex-1 bg-background px-4 py-10 sm:px-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <h1 className="font-serif text-3xl text-foreground">
          Book card review — Phase 0
        </h1>
        <p className="mt-1 text-sm text-muted">
          {books.length} synthetic placeholder books, for reviewing the card
          design across variety before swipe mechanics land in Phase 1.
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
