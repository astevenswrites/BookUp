// Pure, no Prisma import — safe for Client Components (see DECISIONS.md D32).
// Mood -> vibe family mapping and palette/pattern config. See D33 for the
// research behind the family groupings and the animation safety approach.
import { VibeTheme } from "@/generated/prisma/enums";

const MOOD_TO_FAMILY: Record<string, VibeTheme> = {
  cozy: VibeTheme.cozy,
  heartwarming: VibeTheme.cozy,
  hopeful: VibeTheme.cozy,
  funny: VibeTheme.cozy,
  dark: VibeTheme.dark,
  tense: VibeTheme.dark,
  unsettling: VibeTheme.dark,
  devastating: VibeTheme.dark,
  whimsical: VibeTheme.whimsical,
  atmospheric: VibeTheme.whimsical,
  bittersweet: VibeTheme.whimsical,
  melancholy: VibeTheme.melancholy,
};

export type ThemeConfig = {
  // Three shades of the SAME hue family (base, lighter, deeper) — not three
  // unrelated colors. Mixing distinct hues at the edges was reading as a
  // murky, busy blend rather than a cohesive glow (user feedback).
  colors: [string, string, string];
  label: string;
  // True when every shade in `colors` is dark enough that the app's default
  // dark-ink text (--foreground/--muted) stops being readable against most
  // of the gradient, not just its edges — unlike cozy/whimsical/melancholy,
  // whose "light" shade is genuinely light. Drives the .vibe-dark body class
  // (see globals.css) that flips text sitting directly on the background to
  // a light color. Text inside white cards is unaffected either way.
  isDark: boolean;
};

export const THEME_CONFIG: Record<VibeTheme, ThemeConfig> = {
  cozy: {
    colors: ["#e8b568", "#f4d9a0", "#c97a3d"],
    label: "Cozy",
    isDark: false,
  },
  dark: {
    colors: ["#5e0b15", "#7a1420", "#2b0a10"],
    label: "Dark",
    isDark: true,
  },
  whimsical: {
    colors: ["#c9a7eb", "#e6d4f5", "#a97fd4"],
    label: "Whimsical",
    isDark: false,
  },
  melancholy: {
    colors: ["#5c6b73", "#7d8ca3", "#46525a"],
    label: "Melancholy",
    isDark: false,
  },
};

// D33 follow-up: full-viewport again, but the center is no longer literal
// `transparent` — that revealed the page's near-white cream background right
// under the login form/buttons, killing contrast for white UI elements.
// Center is now a muted tint of the theme's own hue (light color mixed
// mostly with white) instead of transparent or a flat white, so the whole
// background reads as "this theme's color," just paler in the middle.
export function buildVignetteGradient(colors: [string, string, string]): string {
  const [base, light] = colors;
  return `radial-gradient(ellipse at center, color-mix(in srgb, ${light} 35%, white) 0%, ${light} 60%, ${base} 100%)`;
}

export const THEME_ORDER: VibeTheme[] = [
  VibeTheme.cozy,
  VibeTheme.dark,
  VibeTheme.whimsical,
  VibeTheme.melancholy,
];

// null return = no strong signal, caller should fall back to the neutral default look
export function deriveVibeTheme(
  moodLabels: string[],
  override: VibeTheme | null
): VibeTheme | null {
  if (override) return override;
  if (moodLabels.length === 0) return null;

  const counts = new Map<VibeTheme, number>();
  for (const label of moodLabels) {
    const family = MOOD_TO_FAMILY[label.toLowerCase()];
    if (family) counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let best: VibeTheme | null = null;
  let bestCount = 0;
  for (const family of THEME_ORDER) {
    const count = counts.get(family) ?? 0;
    if (count > bestCount) {
      best = family;
      bestCount = count;
    }
  }
  return best;
}
