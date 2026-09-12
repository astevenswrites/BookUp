import Link from "next/link";

// D42: shown once an anonymous session hits ANONYMOUS_PREVIEW_SWIPE_CAP —
// replaces "keep swiping anonymously forever" (D22/D28's original stance)
// with a hard stop after a small taste of real matching. No interactivity
// beyond plain links, so this renders fine from both the server-rendered
// page.tsx path and client-side inside SwipeDeck when the cap is hit
// mid-session.
export function SignUpWall({ matchCount }: { matchCount: number }) {
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
    </div>
  );
}
