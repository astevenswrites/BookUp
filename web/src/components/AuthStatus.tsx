import Link from "next/link";
import { signOut } from "@/app/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function AuthStatus() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // D61: trimmed to just Home + sign in/out. Profile, Blind date, Trending,
  // and Today's picks used to live here too, but cramming every feature
  // into this floating row is exactly what caused D60's mobile wrapping
  // mess — they now live as cards on the Home dashboard (`/`) instead, and
  // this row only ever needs to get someone back there or in/out of an
  // account. `right-4` (not just `left-4`) plus `flex-wrap` keeps this
  // robust on narrow screens even now that it's short.
  const pillClass =
    "whitespace-nowrap rounded-full border border-card-border bg-card/90 px-3 py-1.5 font-medium text-foreground/70 shadow-sm backdrop-blur-sm hover:border-accent";

  return (
    <div className="fixed left-4 right-4 top-4 z-10 flex flex-wrap items-center gap-2 text-xs">
      <Link href="/" className={pillClass}>
        Home
      </Link>
      {user ? (
        <form action={signOut}>
          <button type="submit" className={pillClass} title={user.email}>
            Sign out
          </button>
        </form>
      ) : (
        <Link href="/login" className={pillClass}>
          Sign in
        </Link>
      )}
    </div>
  );
}
