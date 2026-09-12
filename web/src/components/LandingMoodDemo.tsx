"use client";

import { useEffect, useState } from "react";
import { THEME_CONFIG, buildVignetteGradient } from "@/lib/theme";
import type { VibeTheme } from "@/generated/prisma/enums";

const DEMO_THEMES: VibeTheme[] = ["cozy", "dark", "whimsical", "melancholy"];

const CAPTIONS: Record<VibeTheme, string> = {
  cozy: "Warm amber, blanket weather, someone's making tea in chapter one.",
  dark: "Deep red. You already know what you're in for.",
  whimsical: "Lilac and a little strange — the books that don't explain themselves.",
  melancholy: "Grey-blue and quiet. For when you want to feel something slowly.",
};

// D41: the landing page's "try it right here" mood picker — purely a
// visual demo for a visitor who hasn't taken the quiz yet (no Preference
// exists), so it drives its own ambient glow rather than touching real
// state. VibeBackground (layout.tsx) renders null for these visitors, so
// there's no conflict with the real glow — this is the only one on screen.
// Toggles .vibe-dark on <body> itself (same mechanism D33's follow-up
// built for the real theme) so the rest of the landing page's text reacts
// correctly when "Dark" is picked; cleans it up on unmount so leaving the
// page can't strand the rest of the app in the dark-text palette.
export function LandingMoodDemo() {
  const [mood, setMood] = useState<VibeTheme>("cozy");

  useEffect(() => {
    document.body.classList.toggle("vibe-dark", THEME_CONFIG[mood].isDark);
    return () => document.body.classList.remove("vibe-dark");
  }, [mood]);

  return (
    <>
      <div
        aria-hidden
        className="vibe-glow pointer-events-none fixed inset-0 -z-10"
        style={{ background: buildVignetteGradient(THEME_CONFIG[mood].colors) }}
      />
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
              onClick={() => setMood(key)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
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
    </>
  );
}
