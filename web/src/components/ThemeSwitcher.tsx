"use client";

import { useTransition } from "react";
import { setThemeOverride } from "@/app/actions";
import { THEME_CONFIG, THEME_ORDER } from "@/lib/theme";
import type { VibeTheme } from "@/generated/prisma/enums";

// Deliberately a small cycling button, not a full theme picker/settings page
// (D33 scope note). currentOverride is null when the theme is auto-derived
// from the reader's quiz moods.
export function ThemeSwitcher({
  currentOverride,
}: {
  currentOverride: VibeTheme | null;
}) {
  const [isPending, startTransition] = useTransition();

  function cycle() {
    const currentIndex = currentOverride ? THEME_ORDER.indexOf(currentOverride) : -1;
    const next = currentIndex + 1 >= THEME_ORDER.length ? null : THEME_ORDER[currentIndex + 1];
    startTransition(async () => {
      await setThemeOverride(next);
    });
  }

  const label = currentOverride ? THEME_CONFIG[currentOverride].label : "Auto";

  return (
    <button
      type="button"
      onClick={cycle}
      disabled={isPending}
      className="fixed bottom-4 right-4 z-10 rounded-full border border-card-border bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground/70 shadow-sm backdrop-blur-sm hover:border-accent disabled:opacity-50"
    >
      🎨 {label}
    </button>
  );
}
