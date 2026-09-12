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
  pattern: "soft-blobs" | "sharp-bands";
  colors: [string, string, string];
  label: string;
};

export const THEME_CONFIG: Record<VibeTheme, ThemeConfig> = {
  cozy: {
    pattern: "soft-blobs",
    colors: ["#e8b568", "#d97757", "#f4c95d"],
    label: "Cozy",
  },
  dark: {
    pattern: "sharp-bands",
    colors: ["#2b1b3d", "#5e0b15", "#14213d"],
    label: "Dark",
  },
  whimsical: {
    pattern: "soft-blobs",
    colors: ["#c9a7eb", "#f2a6c1", "#a7d8eb"],
    label: "Whimsical",
  },
  melancholy: {
    pattern: "soft-blobs",
    colors: ["#5c6b73", "#7d8ca3", "#9a8fa8"],
    label: "Melancholy",
  },
};

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
