"use client";

import { useTransition } from "react";
import { setCurrentMood } from "@/app/actions";
import type { TagOption } from "@/lib/tags";

// D39: "what do you feel like reading today?" — reweights the deck toward
// one mood on top of the quiz's baseline preferences. Sticky by design (the
// user's explicit call): stays set until manually changed or cleared here,
// not reset per session.
export function MoodQuickSelect({
  moods,
  currentMoodTagId,
}: {
  moods: TagOption[];
  currentMoodTagId: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function pick(tagId: string) {
    const next = tagId === currentMoodTagId ? null : tagId;
    startTransition(() => setCurrentMood(next));
  }

  return (
    <div className="mx-auto mb-2 w-full max-w-sm">
      <p className="mb-2 text-center text-xs text-on-vibe-muted">
        What do you feel like reading today?
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {moods.map((mood) => (
          <button
            key={mood.id}
            type="button"
            disabled={isPending}
            onClick={() => pick(mood.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-50 ${
              currentMoodTagId === mood.id
                ? "border-accent bg-accent text-accent-foreground"
                : "border-card-border bg-card/90 text-foreground hover:border-accent"
            }`}
          >
            {mood.label}
          </button>
        ))}
      </div>
    </div>
  );
}
