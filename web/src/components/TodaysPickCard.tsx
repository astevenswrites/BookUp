"use client";

import { useState, useTransition } from "react";
import { BookCard } from "@/components/BookCard";
import { addPickToShelf } from "@/app/actions";
import type { BookWithTags } from "@/lib/books";

export function TodaysPickCard({ book }: { book: BookWithTags }) {
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <BookCard book={book} />
      <button
        type="button"
        disabled={isPending || added}
        onClick={() =>
          startTransition(async () => {
            await addPickToShelf(book.id);
            setAdded(true);
          })
        }
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {added ? "Added to shelf" : "+ Add to shelf"}
      </button>
    </div>
  );
}
