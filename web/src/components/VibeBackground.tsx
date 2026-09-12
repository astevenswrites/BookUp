import { THEME_CONFIG, buildVignetteGradient } from "@/lib/theme";
import type { VibeTheme } from "@/generated/prisma/enums";

// Fixed, full-viewport, decorative only — never intercepts clicks, never
// announced to screen readers. See DECISIONS.md D33 for the research, the
// animation safety approach, and the iteration history — this final shape
// (a full-edge vignette, richly colored) came out of a design-canvas
// exploration where the user picked "Option F" directly.
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
