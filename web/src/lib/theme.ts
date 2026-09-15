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
    // D51 design pass: melancholy now flips to dark mode too (see
    // buildGroundTint / the [data-mode] token set below) — a slate-blue
    // ground this deep needs light ink, the same problem dark's wine-red
    // ground had.
    colors: ["#5c6b73", "#7d8ca3", "#46525a"],
    label: "Melancholy",
    isDark: true,
  },
};

// D51 ("Reading Room" pass): the ground is now a flat OPAQUE fill — the
// previous single radial gradient (however its stops were tuned) could
// never truly reach the corners with color, since the gradient itself
// *is* the color and a box's corners are always farthest from center.
// Per-family base opacity (before the `+drag` boost VibeBackground adds).
export const GROUND_TINT_OPACITY: Record<VibeTheme, number> = {
  cozy: 0.86,
  whimsical: 0.84,
  melancholy: 0.92,
  dark: 0.96,
};

// Dark-mode families ground on their own *deep* shade; light-mode families
// ground on their *light* shade — either way, the flat fill IS what carries
// color to the edges, so light/blur/dust layers on top only need to breathe.
export function getGroundTintColor(theme: VibeTheme): string {
  const { colors, isDark } = THEME_CONFIG[theme];
  return isDark ? colors[2] : colors[1];
}

// D51 §1b: with an opaque ground, fixed ink can't survive contact with a
// genuinely dark surface. `dark` and `melancholy` are both "dark mode" by
// `isDark`, but they need *different* ink hues (warm rose vs. cool
// periwinkle) — accent purple disappears into both, for different reasons
// — so this is keyed by theme, not collapsed to a light/dark boolean.
// Cards and their contents are deliberately NOT part of this system (D51:
// "cards are cream surfaces sitting on the ground, not part of it") — they
// keep using --foreground/--muted unconditionally, same as before.
export type InkTokens = {
  "--ink-head": string;
  "--ink-body": string;
  "--ink-faint": string;
  "--ink-accent": string;
  "--rule": string;
  "--track": string;
  "--panel": string;
  "--panel-edge": string;
};

const LIGHT_INK: InkTokens = {
  "--ink-head": "#241b2f",
  "--ink-body": "#453e50",
  "--ink-faint": "#645b6b",
  "--ink-accent": "#4c2273",
  "--rule": "#241b2f",
  "--track": "rgba(36, 27, 47, .2)",
  "--panel": "rgba(255, 255, 255, .72)",
  "--panel-edge": "#ece4d8",
};

export const INK_TOKENS: Record<VibeTheme, InkTokens> = {
  cozy: LIGHT_INK,
  whimsical: LIGHT_INK,
  dark: {
    "--ink-head": "#fdf4f2",
    "--ink-body": "#f3dcd9",
    "--ink-faint": "#dcb6b2",
    "--ink-accent": "#f0b7c4",
    "--rule": "rgba(253, 244, 242, .72)",
    "--track": "rgba(253, 244, 242, .22)",
    "--panel": "rgba(28, 8, 12, .42)",
    "--panel-edge": "rgba(253, 244, 242, .18)",
  },
  melancholy: {
    "--ink-head": "#f7fafb",
    "--ink-body": "#e2ebef",
    "--ink-faint": "#bccbd3",
    "--ink-accent": "#cfd9ff",
    "--rule": "rgba(247, 250, 251, .72)",
    "--track": "rgba(247, 250, 251, .22)",
    "--panel": "rgba(18, 28, 34, .38)",
    "--panel-edge": "rgba(247, 250, 251, .18)",
  },
};

export const THEME_ORDER: VibeTheme[] = [
  VibeTheme.cozy,
  VibeTheme.dark,
  VibeTheme.whimsical,
  VibeTheme.melancholy,
];

// D33 second correction: applied whenever deriveVibeTheme has no signal to
// go on (no account/session yet — login, pre-quiz — or a Preference with no
// mood tags picked). Originally these cases showed no glow at all ("don't
// guess"), but once the rest of the app leaned into the glow as its visual
// identity, a flat background everywhere else read as broken, not neutral.
// Matches LandingMoodDemo's own default so the very first thing a visitor
// sees is consistent with what the quiz result would look like.
export const DEFAULT_VIBE_THEME: VibeTheme = VibeTheme.cozy;

// null return = no strong signal; callers apply DEFAULT_VIBE_THEME on null.
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
