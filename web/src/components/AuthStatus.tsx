import Link from "next/link";
import { signOut } from "@/app/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function AuthStatus() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // D60: this row has no explicit width (fixed + only `left` set), so its
  // shrink-to-fit computed width was getting capped at the viewport edge on
  // narrow screens — with `flex-wrap` never enabled, the flex items
  // shrank (default flex-shrink:1) instead of wrapping onto a new line,
  // and shrinking a pill below its label's natural width just wrapped the
  // TEXT inside it, producing uneven two-line pills. `right-4` gives the
  // row an explicit width to wrap within; `flex-wrap` lets pills flow onto
  // additional rows instead; `whitespace-nowrap` keeps each pill's own
  // label on one line once wrapping is happening at the pill level instead.
  const pillClass =
    "whitespace-nowrap rounded-full border border-card-border bg-card/90 px-3 py-1.5 font-medium text-foreground/70 shadow-sm backdrop-blur-sm hover:border-accent";

  return (
    <div className="fixed left-4 right-4 top-4 z-10 flex flex-wrap items-center gap-2 text-xs">
      <Link href="/" className={pillClass}>
        Home
      </Link>
      <Link href="/profile" className={pillClass}>
        Profile
      </Link>
      <Link href="/blind-date" className={pillClass}>
        Blind date
      </Link>
      <Link href="/trending" className={pillClass}>
        Trending
      </Link>
      {user ? (
        <>
          <Link href="/today" className={pillClass}>
            Today&apos;s picks
          </Link>
          <form action={signOut}>
            <button type="submit" className={pillClass} title={user.email}>
              Sign out
            </button>
          </form>
        </>
      ) : (
        <Link href="/login" className={pillClass}>
          Sign in
        </Link>
      )}
    </div>
  );
}
