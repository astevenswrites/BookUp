import { THEME_CONFIG } from "@/lib/theme";
import type { VibeTheme } from "@/generated/prisma/enums";

// Fixed, full-viewport, decorative only — never intercepts clicks, never
// announced to screen readers. See DECISIONS.md D33 for the research this
// is based on and the animation safety approach.
export function VibeBackground({ theme }: { theme: VibeTheme | null }) {
  if (!theme) return null;

  const config = THEME_CONFIG[theme];
  const [a, b, c] = config.colors;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {config.pattern === "soft-blobs" ? (
        <>
          <div
            className="vibe-blob-a absolute -left-1/4 -top-1/4 h-[70vmax] w-[70vmax] rounded-full blur-3xl"
            style={{ background: a, opacity: 0.5 }}
          />
          <div
            className="vibe-blob-b absolute -right-1/4 top-1/3 h-[60vmax] w-[60vmax] rounded-full blur-3xl"
            style={{ background: b, opacity: 0.45 }}
          />
          <div
            className="vibe-blob-c absolute bottom-[-20%] left-1/4 h-[55vmax] w-[55vmax] rounded-full blur-3xl"
            style={{ background: c, opacity: 0.4 }}
          />
        </>
      ) : (
        <>
          <div
            className="vibe-blob-a absolute -left-1/3 top-0 h-[140vmax] w-[45vmax] origin-top-left rotate-12 blur-xl"
            style={{ background: a, opacity: 0.5 }}
          />
          <div
            className="vibe-blob-b absolute right-[-10%] top-[-10%] h-[130vmax] w-[35vmax] origin-top-right -rotate-12 blur-xl"
            style={{ background: b, opacity: 0.4 }}
          />
          <div
            className="vibe-blob-c absolute bottom-[-30%] left-1/3 h-[120vmax] w-[30vmax] rotate-6 blur-xl"
            style={{ background: c, opacity: 0.35 }}
          />
        </>
      )}
    </div>
  );
}
