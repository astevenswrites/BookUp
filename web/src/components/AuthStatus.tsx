import Link from "next/link";
import { signOut } from "@/app/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function AuthStatus() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="fixed left-4 top-4 z-10 flex items-center gap-2 text-xs">
      <Link
        href="/"
        className="rounded-full border border-card-border bg-card/90 px-3 py-1.5 font-medium text-foreground/70 shadow-sm backdrop-blur-sm hover:border-accent"
      >
        Home
      </Link>
      <Link
        href="/profile"
        className="rounded-full border border-card-border bg-card/90 px-3 py-1.5 font-medium text-foreground/70 shadow-sm backdrop-blur-sm hover:border-accent"
      >
        Profile
      </Link>
      <Link
        href="/blind-date"
        className="rounded-full border border-card-border bg-card/90 px-3 py-1.5 font-medium text-foreground/70 shadow-sm backdrop-blur-sm hover:border-accent"
      >
        Blind date
      </Link>
      <Link
        href="/trending"
        className="rounded-full border border-card-border bg-card/90 px-3 py-1.5 font-medium text-foreground/70 shadow-sm backdrop-blur-sm hover:border-accent"
      >
        Trending
      </Link>
      {user ? (
        <>
          <Link
            href="/today"
            className="rounded-full border border-card-border bg-card/90 px-3 py-1.5 font-medium text-foreground/70 shadow-sm backdrop-blur-sm hover:border-accent"
          >
            Today&apos;s picks
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-card-border bg-card/90 px-3 py-1.5 font-medium text-foreground/70 shadow-sm backdrop-blur-sm hover:border-accent"
              title={user.email}
            >
              Sign out
            </button>
          </form>
        </>
      ) : (
        <Link
          href="/login"
          className="rounded-full border border-card-border bg-card/90 px-3 py-1.5 font-medium text-foreground/70 shadow-sm backdrop-blur-sm hover:border-accent"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
