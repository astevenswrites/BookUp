"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const REDIRECT_DELAY_SECONDS = 8;

// D42: shown once an anonymous session hits ANONYMOUS_PREVIEW_SWIPE_CAP —
// replaces "keep swiping anonymously forever" (D22/D28's original stance)
// with a hard stop after a small taste of real matching. Renders fine from
// both the server-rendered /swipe/page.tsx path and client-side inside
// SwipeDeck when the cap is hit mid-session.
// D63: this used to be a dead end with no way forward except Sign up/Log
// in — now it auto-redirects to the landing page (`/`, D62) after a short
// delay if they don't act, so an anonymous visitor who's done exploring
// isn't just parked here indefinitely.
export function SignUpWall({ matchCount }: { matchCount: number }) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_DELAY_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      router.push("/");
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, router]);

  return (
    <div className="mx-auto flex w-full min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h2 className="font-serif text-2xl text-on-vibe">
        {matchCount > 0
          ? `You matched with ${matchCount} book${matchCount === 1 ? "" : "s"}!`
          : "That's the preview!"}
      </h2>
      <p className="mt-2 text-sm text-on-vibe-muted">
        Sign up or log in to save {matchCount > 0 ? "these matches" : "your shelf"} and keep
        swiping for more.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/login"
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-card-border bg-card/70 px-6 py-2.5 text-sm font-medium text-foreground"
        >
          Log in
        </Link>
      </div>
      <p className="mt-6 text-xs text-on-vibe-muted">
        Taking you back home in {secondsLeft}s...
      </p>
    </div>
  );
}
