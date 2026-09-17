"use client";

import { useTransition } from "react";
import { BookCard } from "@/components/BookCard";
import { ShareButton } from "@/components/ShareButton";
import { updateTbrStatus, removeTbrEntry, keepTbrEntry } from "@/app/actions";
import { isStale, daysSince } from "@/lib/tbr";
import type { BookWithTags } from "@/lib/books";
import { TbrStatus } from "@/generated/prisma/enums";

const STATUS_LABEL: Record<TbrStatus, string> = {
  to_read: "To read",
  reading: "Reading",
  finished: "Finished",
  dnf: "Didn't finish",
};

export function TbrEntryCard({
  entry,
}: {
  entry: { id: string; status: TbrStatus; updatedAt: Date; book: BookWithTags };
}) {
  const [isPending, startTransition] = useTransition();

  function setStatus(status: TbrStatus) {
    startTransition(() => updateTbrStatus(entry.id, status));
  }

  return (
    <div className="flex flex-col gap-2">
      <BookCard book={entry.book} />

      {isStale(entry) && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-tag-mood px-3 py-2 text-xs text-tag-mood-foreground">
          <span>Added {daysSince(entry.updatedAt)} days ago — still interested?</span>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => keepTbrEntry(entry.id))}
              className="font-medium underline disabled:opacity-50"
            >
              Yes
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => removeTbrEntry(entry.id))}
              className="font-medium underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(STATUS_LABEL) as TbrStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            disabled={isPending}
            onClick={() => setStatus(status)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
              entry.status === status
                ? "border-accent bg-accent text-accent-foreground"
                : "border-card-border bg-card text-foreground/70 hover:border-accent"
            }`}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => removeTbrEntry(entry.id))}
          className="rounded-full border border-card-border bg-card px-2.5 py-1 text-xs font-medium text-muted hover:border-accent disabled:opacity-50"
        >
          Remove
        </button>
        <ShareButton bookId={entry.book.id} title={entry.book.title} />
      </div>
    </div>
  );
}
