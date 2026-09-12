import { THEME_CONFIG } from "@/lib/theme";
import type { VibeTheme } from "@/generated/prisma/enums";

// Fixed, full-viewport, decorative only — never intercepts clicks, never
// announced to screen readers. See DECISIONS.md D33 for the research and
// the animation safety approach.
//
// One smooth radial gradient, transparent at center (where the card sits)
// fading to the theme color at the edges, with a single unified opacity
// breathe. A prior version used several independently-blurred, independently
// -animated blobs, which read as a patchy/mottled texture rather than a
// clean gradient — simplified to exactly one layer per direct feedback.
export function VibeBackground({ theme }: { theme: VibeTheme | null }) {
  if (!theme) return null;

  const [base, light, deep] = THEME_CONFIG[theme].colors;

  return (
    <div
      aria-hidden
      className="vibe-glow pointer-events-none fixed inset-0 -z-10"
      style={{
        background: `radial-gradient(ellipse at center, transparent 30%, ${light} 65%, ${base} 85%, ${deep} 100%)`,
      }}
    />
  );
}
