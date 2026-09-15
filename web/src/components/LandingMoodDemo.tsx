"use client";

import { useState, useTransition } from "react";
import { setDemoThemeOverride, setThemeOverride } from "@/app/actions";
import { THEME_CONFIG } from "@/lib/theme";
import type { VibeTheme } from "@/generated/prisma/enums";

const DEMO_THEMES: VibeTheme[] = ["cozy", "dark", "whimsical", "melancholy"];

const CAPTIONS: Record<VibeTheme, string> = {
  cozy: "Warm amber, blanket weather, someone's making tea in chapter one.",
  dark: "Deep red. You already know what you're in for.",
  whimsical: "Lilac and a little strange — the books that don't explain themselves.",
  melancholy: "Grey-blue and quiet. For when you want to feel something slowly.",
};

// D41 correction: this used to be pure local React state driving its own
// throwaway glow div — it reset the instant a visitor navigated anywhere
// else, which read as broken rather than a toy demo. Now persists via the
// same setDemoThemeOverride Server Action/cookie (lib/session.ts) that
// layout.tsx reads for every pre-quiz page, so the choice survives
// navigation exactly like the real post-quiz ThemeSwitcher does. Local
// state here is just for instant click feedback — the real global
// VibeBackground/.vibe-dark (layout.tsx) picks up the persisted value a
// moment later via the Server Action's revalidatePath.
// D64: `persistent` is true when the current actor already has a
// Preference (D62 made Landing reachable for anonymous sessions that have
// already taken the quiz, not just first-time visitors). In that case
// layout.tsx's theme always derives from the real preference, never the
// demo cookie — clicking a mood here has to write to that SAME
// `themeOverride` field (via `setThemeOverride`, the exact action the real
// `ThemeSwitcher` pill already uses) or it has no visible effect at all.
export function LandingMoodDemo({
  initialTheme,
  persistent = false,
}: {
  initialTheme: VibeTheme;
  persistent?: boolean;
}) {
  const [mood, setMood] = useState<VibeTheme>(initialTheme);
  const [isPending, startTransition] = useTransition();

  function pick(theme: VibeTheme) {
    setMood(theme);
    startTransition(() => (persistent ? setThemeOverride(theme) : setDemoThemeOverride(theme)));
  }

  return (
    <div className="rounded-2xl border border-card-border bg-card/80 p-5 shadow-lg backdrop-blur-sm">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
        Try it right here
      </p>
      <p className="mb-4 font-serif text-lg text-foreground">
        Pick a feeling. Watch the page change.
      </p>
      <div className="flex flex-wrap gap-2">
        {DEMO_THEMES.map((key) => (
          <button
            key={key}
            type="button"
            disabled={isPending}
            onClick={() => pick(key)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-70 ${
              mood === key
                ? "border-foreground bg-foreground text-background"
                : "border-card-border bg-card text-foreground hover:border-accent"
            }`}
          >
            {THEME_CONFIG[key].label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">{CAPTIONS[mood]}</p>
    </div>
  );
}
