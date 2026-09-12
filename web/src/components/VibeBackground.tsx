import { THEME_CONFIG, buildVignetteGradient } from "@/lib/theme";
import type { VibeTheme } from "@/generated/prisma/enums";

// Fixed, full-viewport, decorative only — never intercepts clicks, never
// announced to screen readers. See DECISIONS.md D33 for the research, the
// animation safety approach, and the iteration history.
//
// The gradient itself (color, stops, opacity) is "Option F" from the design
// canvas exploration — kept as-is per feedback ("color is better"). What
// changed here: the glow is now confined to a box sized/shaped like the
// card's own footprint, not stretched across the full viewport (a full-width
// radial gradient reads as a wide oval "on the page," not a glow "behind the
// card" — this constrains it to the latter).
export function VibeBackground({ theme }: { theme: VibeTheme | null }) {
  if (!theme) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center overflow-hidden"
    >
      <div
        className="vibe-glow"
        style={{
          width: "min(640px, 90vw)",
          height: "min(820px, 90vh)",
          background: buildVignetteGradient(THEME_CONFIG[theme].colors),
        }}
      />
    </div>
  );
}
