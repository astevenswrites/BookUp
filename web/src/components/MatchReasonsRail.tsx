import { THEME_CONFIG, deriveVibeTheme } from "@/lib/theme";
import type { MatchReason } from "@/lib/matchReasons";

const DOT_COLOR: Record<string, string> = {
  mood: "#234a63",
  trope: "#5b2a86",
  genre: "#4a3f33",
  collaborative: "#1f7a5c",
};

// D40: the actual tag overlaps that scored the top card, so the matching
// algorithm (D25) isn't a black box. Shared between the desktop sticky
// rail below and the mobile bottom-sheet in MatchReasonsMobile.tsx — same
// content, two different containers.
export function MatchReasonsContent({
  reasons,
  moodLabels,
}: {
  reasons: MatchReason[];
  moodLabels: string[];
}) {
  const vibeFamily = deriveVibeTheme(moodLabels, null) ?? "whimsical";
  const vibe = THEME_CONFIG[vibeFamily];

  return (
    <>
      {reasons.length === 0 ? (
        <p className="text-sm text-muted">Nothing scored yet — this one&apos;s a wildcard.</p>
      ) : (
        <ul className="flex flex-col">
          {reasons.map((reason, i) => (
            <li
              key={`${reason.category}-${reason.label}`}
              className={`flex items-center gap-2.5 py-1.5 ${
                i < reasons.length - 1 ? "border-b border-black/5" : ""
              }`}
            >
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ background: DOT_COLOR[reason.category] ?? DOT_COLOR.genre }}
              />
              <span className="flex-1 text-sm capitalize text-foreground">{reason.label}</span>
              <span className="text-xs font-medium text-muted">×{reason.weight}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Vibe reading
        </p>
        <div className="flex items-center gap-2.5">
          <span
            className="h-6 w-6 flex-none rounded-full"
            style={{
              background: `linear-gradient(135deg, ${vibe.colors[0]}, ${vibe.colors[2]})`,
            }}
          />
          <span className="font-serif text-lg text-foreground">{vibe.label}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The glow behind the page is reading this card. Swipe and the room changes with it.
        </p>
      </div>
    </>
  );
}

// Desktop only — there's room for a permanent side rail. `sticky` so it
// floats alongside the card as the page scrolls (the card can grow taller
// than the viewport when "More details" is expanded, without the rail
// scrolling out of view). See MatchReasonsMobile for the phone/tablet
// equivalent (a floating button + bottom sheet, not squeezed into the page).
export function MatchReasonsRail({
  reasons,
  moodLabels,
}: {
  reasons: MatchReason[];
  moodLabels: string[];
}) {
  return (
    <aside className="sticky top-8 hidden w-[300px] flex-none self-start pt-12 lg:block">
      <div className="rounded-2xl border border-card-border bg-card/80 p-5 backdrop-blur-sm">
        <p className="mb-3.5 text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Why this one
        </p>
        <MatchReasonsContent reasons={reasons} moodLabels={moodLabels} />
      </div>
    </aside>
  );
}
