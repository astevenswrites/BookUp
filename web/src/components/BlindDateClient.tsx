"use client";

import { useState, useTransition } from "react";
import { BookCard } from "@/components/BookCard";
import { swipeBook, getBlindDateSurprise, getBlindDateCommunityPick } from "@/app/actions";
import type { BookWithTags } from "@/lib/books";

type Mode = "surprise" | "community";
type PickState =
  | { kind: "start" }
  | { kind: "loading"; mode: Mode }
  | { kind: "book"; mode: Mode; book: BookWithTags }
  | { kind: "empty" }
  | { kind: "decided" };

// D48: two separate, explicit entry points rather than one blended feature —
// "Surprise Me" always works (algorithmic, D45's implicit weights inverted
// to find unexplored tags); "Community Pick" is honest when there isn't
// enough real cross-user data yet rather than faking a result.
export function BlindDateClient() {
  const [state, setState] = useState<PickState>({ kind: "start" });
  const [, startTransition] = useTransition();

  function requestPick(mode: Mode) {
    setState({ kind: "loading", mode });
    startTransition(async () => {
      if (mode === "surprise") {
        const book = await getBlindDateSurprise();
        setState(book ? { kind: "book", mode, book } : { kind: "empty" });
      } else {
        const result = await getBlindDateCommunityPick();
        setState(result.status === "ok" ? { kind: "book", mode, book: result.book } : { kind: "empty" });
      }
    });
  }

  function decide(book: BookWithTags, direction: "left" | "right") {
    setState({ kind: "decided" });
    startTransition(async () => {
      await swipeBook(book.id, direction);
    });
  }

  const showPrompt = state.kind === "start" || state.kind === "decided" || state.kind === "empty";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-14 text-center">
      <h1 className="font-serif text-2xl text-on-vibe">Blind Date</h1>
      <p className="mt-1 text-sm text-on-vibe-muted">
        One book, no deck to browse — pick how far off your usual path you want to go.
      </p>

      {state.kind === "decided" && (
        <p className="mt-6 text-sm font-medium text-on-vibe">Logged. Want another blind date?</p>
      )}
      {state.kind === "empty" && (
        <p className="mt-6 rounded-xl border border-card-border bg-card px-4 py-3 text-sm text-muted">
          Blind Date needs a few more readers before a real community pick is possible — try Surprise
          Me instead.
        </p>
      )}

      {showPrompt && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => requestPick("surprise")}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground"
          >
            Surprise Me
          </button>
          <button
            type="button"
            onClick={() => requestPick("community")}
            className="rounded-full border border-card-border bg-card px-6 py-2.5 text-sm font-medium text-foreground hover:border-accent"
          >
            Community Pick
          </button>
        </div>
      )}

      {state.kind === "loading" && (
        <p className="mt-10 text-sm text-on-vibe-muted">Finding your match...</p>
      )}

      {state.kind === "book" && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-on-vibe-muted">
            {state.mode === "surprise" ? "A wildcard pick, just for you" : "A community favorite"}
          </p>
          <BookCard book={state.book} />
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => decide(state.book, "left")}
              aria-label="Pass"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-card-border bg-card text-2xl text-foreground/60 shadow-sm hover:border-foreground/30"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => decide(state.book, "right")}
              aria-label="Add to shelf"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-accent bg-accent text-2xl text-accent-foreground shadow-sm"
            >
              ♥
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
