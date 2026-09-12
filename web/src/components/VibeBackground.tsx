import { THEME_CONFIG } from "@/lib/theme";
import type { VibeTheme } from "@/generated/prisma/enums";

// Fixed, full-viewport, decorative only — never intercepts clicks, never
// announced to screen readers. See DECISIONS.md D33 for the research this
// is based on and the animation safety approach.
//
// Glow lives at the screen's edges/corners, not the center — the card sits
// in a calm, uncluttered middle. Colors are shades of one hue family per
// theme so the breathing motion reads as a single cohesive glow, not a
// blend of clashing colors (revised per direct feedback on the first version).
export function VibeBackground({ theme }: { theme: VibeTheme | null }) {
  if (!theme) return null;

  const [base, light, deep] = THEME_CONFIG[theme].colors;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="vibe-blob-a absolute -left-[15%] -top-[15%] h-[55vmax] w-[55vmax] rounded-full blur-3xl"
        style={{ background: base, opacity: 0.4 }}
      />
      <div
        className="vibe-blob-b absolute -right-[15%] -top-[10%] h-[50vmax] w-[50vmax] rounded-full blur-3xl"
        style={{ background: light, opacity: 0.35 }}
      />
      <div
        className="vibe-blob-c absolute -bottom-[20%] -left-[10%] h-[50vmax] w-[50vmax] rounded-full blur-3xl"
        style={{ background: deep, opacity: 0.35 }}
      />
      <div
        className="vibe-blob-b absolute -bottom-[15%] -right-[15%] h-[50vmax] w-[50vmax] rounded-full blur-3xl"
        style={{ background: base, opacity: 0.3 }}
      />
    </div>
  );
}
