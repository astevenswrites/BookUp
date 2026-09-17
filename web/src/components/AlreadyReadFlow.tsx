"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { submitAlreadyRead, getBooksForAuthors, importReadingHistory } from "@/app/actions";
import { detectImportFormat } from "@/lib/importParsing";
import type { AuthorCandidate } from "@/lib/alreadyRead";
import type { BookWithTags } from "@/lib/books";

// D81: intentionally NOT the full BookCard — that's built for one book at
// a time (cover-dominant, tags, hook line, tap-to-expand detail) and would
// be far too heavy for a fast multi-select grid. This is just enough to
// recognize a book by: cover, title, author, a toggleable selected state.
function BookTile({
  book,
  selected,
  onToggle,
}: {
  book: BookWithTags;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`flex flex-col overflow-hidden rounded-xl border-2 text-left transition-colors ${
        selected ? "border-accent" : "border-transparent"
      }`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-foreground/5">
        {/* eslint-disable-next-line @next/next/no-img-element -- same convention as BookCard */}
        <img src={book.coverUrl} alt={`Cover of ${book.title}`} className="h-full w-full object-contain" />
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-accent/40">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-lg text-accent-foreground">
              ✓
            </div>
          </div>
        )}
      </div>
      <div className="bg-card p-2">
        <p className="truncate text-xs font-medium text-foreground">{book.title}</p>
        <p className="truncate text-xs text-muted">{book.author}</p>
      </div>
    </button>
  );
}

function AuthorTile({
  author,
  bookCount,
  selected,
  onToggle,
}: {
  author: string;
  bookCount: number;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-colors ${
        selected ? "border-accent bg-accent/10" : "border-card-border bg-card hover:border-accent"
      }`}
    >
      <p className="font-medium text-foreground">{author}</p>
      <p className="text-xs text-muted">
        {bookCount} book{bookCount === 1 ? "" : "s"} in our catalog
      </p>
    </button>
  );
}

function StickyFooter({
  count,
  skipLabel,
  continueLabel,
  onSkip,
  onContinue,
  disabled,
}: {
  count: number;
  skipLabel: string;
  continueLabel: string;
  onSkip: () => void;
  onContinue: () => void;
  disabled: boolean;
}) {
  return (
    <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-4 border-t border-card-border bg-background/95 py-4 backdrop-blur-sm">
      <p className="text-sm text-on-vibe-muted">{count} selected</p>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onSkip}
          className="rounded-full border border-card-border bg-card/70 px-5 py-2.5 text-sm font-medium text-foreground disabled:opacity-50"
        >
          {skipLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onContinue}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {count > 0 ? `${continueLabel} (${count})` : continueLabel}
        </button>
      </div>
    </div>
  );
}

// D82: upload lives on the "authors" screen rather than a separate route —
// same page, an alternative path for readers who have a Goodreads/
// StoryGraph export handy and want exact matches instead of the (fast, but
// approximate) author-expansion flow below it.
function ImportUpload({
  onMatched,
  disabled,
}: {
  onMatched: (books: BookWithTags[], summary: { matched: number; total: number }) => void;
  disabled: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "parsing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setStatus("parsing");
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const format = detectImportFormat(results.meta.fields ?? []);
        if (!format) {
          setStatus("error");
          setError("That doesn't look like a Goodreads or StoryGraph export — couldn't find the expected columns.");
          return;
        }
        const { matched, totalReadRows } = await importReadingHistory(format, results.data);
        setStatus("idle");
        if (inputRef.current) inputRef.current.value = "";
        onMatched(matched, { matched: matched.length, total: totalReadRows });
      },
      error: () => {
        setStatus("error");
        setError("Couldn't read that file — make sure it's the CSV export, unedited.");
      },
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-dashed border-card-border bg-card/50 p-4">
      <p className="text-sm font-medium text-foreground">
        Have a Goodreads or StoryGraph export?
      </p>
      <p className="mt-1 text-xs text-muted">
        Upload the CSV for exact matches instead of guessing from authors below.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        disabled={disabled || status === "parsing"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="mt-3 text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-1.5 file:text-xs file:font-medium file:text-accent-foreground disabled:opacity-50"
      />
      {status === "parsing" && <p className="mt-2 text-xs text-on-vibe-accent">Reading your export…</p>}
      {status === "error" && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// D81/D82: three phases in one client component (not separate routes) so
// state (picked authors, an in-progress import) never needs to round-trip
// through a URL.
export function AlreadyReadFlow({ authors }: { authors: AuthorCandidate[] }) {
  const [phase, setPhase] = useState<"authors" | "review">("authors");
  const [selectedAuthors, setSelectedAuthors] = useState<Set<string>>(new Set());
  const [books, setBooks] = useState<BookWithTags[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [importSummary, setImportSummary] = useState<{ matched: number; total: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleAuthor(author: string) {
    setSelectedAuthors((prev) => {
      const next = new Set(prev);
      if (next.has(author)) next.delete(author);
      else next.add(author);
      return next;
    });
  }

  function toggleBook(bookId: string) {
    setSelectedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }

  function handleAuthorsContinue() {
    if (selectedAuthors.size === 0) {
      router.push("/swipe");
      return;
    }
    startTransition(async () => {
      const fetched = await getBooksForAuthors([...selectedAuthors]);
      setImportSummary(null);
      setBooks(fetched);
      setSelectedBooks(new Set(fetched.map((b) => b.id))); // pre-checked: "I read this author" defaults to "and I've read their books here"
      setPhase("review");
    });
  }

  function handleImportMatched(matched: BookWithTags[], summary: { matched: number; total: number }) {
    setBooks(matched);
    setSelectedBooks(new Set(matched.map((b) => b.id))); // pre-checked: these are precise import matches, higher trust than the author-expansion default
    setImportSummary(summary);
    setPhase("review");
  }

  function handleReviewContinue() {
    startTransition(async () => {
      await submitAlreadyRead([...selectedBooks]);
      router.push("/swipe");
    });
  }

  if (phase === "authors") {
    return (
      <>
        <ImportUpload onMatched={handleImportMatched} disabled={isPending} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map(({ author, bookCount }) => (
            <AuthorTile
              key={author}
              author={author}
              bookCount={bookCount}
              selected={selectedAuthors.has(author)}
              onToggle={() => toggleAuthor(author)}
            />
          ))}
        </div>
        <StickyFooter
          count={selectedAuthors.size}
          skipLabel="Skip"
          continueLabel="Continue"
          disabled={isPending}
          onSkip={() => router.push("/swipe")}
          onContinue={handleAuthorsContinue}
        />
      </>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-on-vibe-muted">
        {importSummary
          ? `Matched ${importSummary.matched} of ${importSummary.total} books you've read to our catalog. All checked by default — uncheck any that shouldn't count.`
          : "All checked by default — uncheck any of these you haven't actually read yet."}
      </p>
      {books.length === 0 ? (
        <p className="text-sm text-on-vibe-muted">
          No matches in our catalog yet — that&apos;s fine, head to the deck.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {books.map((book) => (
            <BookTile
              key={book.id}
              book={book}
              selected={selectedBooks.has(book.id)}
              onToggle={() => toggleBook(book.id)}
            />
          ))}
        </div>
      )}
      <StickyFooter
        count={selectedBooks.size}
        skipLabel="Back"
        continueLabel="Continue"
        disabled={isPending}
        onSkip={() => setPhase("authors")}
        onContinue={handleReviewContinue}
      />
    </>
  );
}
