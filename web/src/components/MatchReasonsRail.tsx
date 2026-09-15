import { THEME_CONFIG, deriveVibeTheme } from "@/lib/theme";
import type { MatchReason } from "@/lib/matchReasons";

const DOT_COLOR: Record<string, string> = {
  mood: "#234a63",
  trope: "#5b2a86",
  genre: "#4a3f33",
  collaborative: "#1f7a5c",
};

// D40: "Why this one" — surfaces the actual tag overlaps that scored the
// top card, so the matching algorithm (D25) isn't a black box. Desktop
// only (see SwipeDeck) — there's no room for a side rail on mobile.
export function MatchReasonsRail({
  reasons,
  moodLabels,
}: {
  reasons: MatchReason[];
  moodLabels: string[];
}) {
  const vibeFamily = deriveVibeTheme(moodLabels, null) ?? "whimsical";
  const vibe = THEME_CONFIG[vibeFamily];

  return (
    <aside className="hidden w-[300px] flex-none pt-12 lg:block">
      <div className="rounded-2xl border border-card-border bg-card/80 p-5 backdrop-blur-sm">
        <p className="mb-3.5 text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Why this one
        </p>
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
      </div>
    </aside>
  );
}
