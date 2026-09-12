import { THEME_CONFIG, buildVignetteGradient } from "@/lib/theme";
import type { VibeTheme } from "@/generated/prisma/enums";

// Fixed, full-viewport, decorative only — never intercepts clicks, never
// announced to screen readers. See DECISIONS.md D33 for the research, the
// animation safety approach, and the iteration history. Reverted back to
// full-viewport coverage after the card-scoped version (D33 follow-up)
// itself got follow-up feedback: the color should fill the whole
// background, not just glow behind the card. The center-transparency
// readability issue is fixed separately, in buildVignetteGradient itself.
export function VibeBackground({ theme }: { theme: VibeTheme | null }) {
  if (!theme) return null;

  return (
    <div
      aria-hidden
      className="vibe-glow pointer-events-none fixed inset-0 -z-10"
      style={{ background: buildVignetteGradient(THEME_CONFIG[theme].colors) }}
    />
  );
}
