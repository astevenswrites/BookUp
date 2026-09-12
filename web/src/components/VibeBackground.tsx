import { THEME_CONFIG } from "@/lib/theme";
import type { VibeTheme } from "@/generated/prisma/enums";

// Fixed, full-viewport, decorative only — never intercepts clicks, never
// announced to screen readers. See DECISIONS.md D33 for the research and
// the animation safety approach, and its "revised" notes for why this ended
// up as a small, subtle, card-centered glow rather than a full-viewport
// effect (two rounds of direct feedback landed here).
export function VibeBackground({ theme }: { theme: VibeTheme | null }) {
  if (!theme) return null;

  const [base] = THEME_CONFIG[theme].colors;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center overflow-hidden"
    >
      <div
        className="vibe-glow h-[80vmin] w-[80vmin] rounded-full blur-[110px]"
        style={{ background: base }}
      />
    </div>
  );
}
