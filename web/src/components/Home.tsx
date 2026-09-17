import Link from "next/link";
import { MoodQuickSelect } from "@/components/MoodQuickSelect";
import type { TagOption } from "@/lib/tags";
import type { Challenge } from "@/lib/challenges";

// D61: the signed-in landing spot. Previously `/` was the swipe deck itself
// (D27/D41) with every other feature (profile, blind date, trending, the
// mood picker) crammed into a floating nav row on top of it — on a narrow
// screen that row had nowhere left to go and started wrapping mid-word
// (D60). Splitting "here's what you can do" (this page) from "here's the
// deck" (`/swipe`) fixes that structurally instead of continuing to squeeze
// more into the same header. Anonymous sessions skip this entirely — see
// page.tsx's routing — the preview funnel (D42) still drops them straight
// into `/swipe`.
const LINKS: { href: string; title: string; body: string }[] = [
  { href: "/tbr", title: "Your shelf", body: "Everything you've matched with, sorted by vibe." },
  { href: "/today", title: "Today's picks", body: "A fresh, hand-matched set every day." },
  { href: "/weekly", title: "This week's picks", body: "Your Super Match, plus a bigger weekly drop." },
  { href: "/blind-date", title: "Blind date", body: "One surprise pick — algorithmic or community." },
  { href: "/trending", title: "Trending", body: "What every reader's adding right now." },
  { href: "/profile", title: "Profile", body: "Your vibe, your stats, retake the quiz." },
];

export function Home({
  moods,
  currentMoodTagId,
  tbrCount,
  remainingToday,
  streak,
  activeChallenge,
}: {
  moods: TagOption[];
  currentMoodTagId: string | null;
  tbrCount: number;
  remainingToday: number;
  streak: number;
  activeChallenge: Challenge | null;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-8">
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-on-vibe-accent">
          BookUp
        </p>
        <h1 className="mt-2 font-serif text-3xl text-on-vibe sm:text-4xl">Welcome back</h1>
        <p className="mt-2 text-sm text-on-vibe-muted">
          {tbrCount} book{tbrCount === 1 ? "" : "s"} on your shelf · {remainingToday} swipe
          {remainingToday === 1 ? "" : "s"} left today
          {streak > 0 && (
            <>
              {" "}
              · <span className="text-on-vibe-accent">
                🔥 {streak}-day streak
              </span>
            </>
          )}
        </p>
      </header>

      {/* D86: the primary discovery hook for a seasonal challenge — deliberately
          framed as "come discover these," not a progress readout. Only shown
          when a challenge is currently active. */}
      {activeChallenge && (
        <Link
          href="/challenges"
          className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-center hover:border-accent"
        >
          <p className="font-serif text-lg text-on-vibe">
            {activeChallenge.emoji} {activeChallenge.label} is here
          </p>
          <p className="mt-1 text-sm text-on-vibe-muted">
            Discover {activeChallenge.genreLabel} books picked for you →
          </p>
        </Link>
      )}

      <MoodQuickSelect moods={moods} currentMoodTagId={currentMoodTagId} />

      <Link
        href="/swipe"
        className="rounded-2xl bg-accent px-6 py-5 text-center font-serif text-xl text-accent-foreground shadow-lg"
      >
        Start swiping
      </Link>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-card-border bg-card/80 p-5 backdrop-blur-sm hover:border-accent"
          >
            <p className="font-serif text-lg text-foreground">{link.title}</p>
            <p className="mt-1 text-sm text-muted">{link.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
