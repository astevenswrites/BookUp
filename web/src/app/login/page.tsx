import Link from "next/link";
import { signInWithPassword, signUpWithPassword } from "@/app/actions";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check_email?: string }>;
}) {
  const { error, check_email } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <h1 className="font-serif text-3xl text-on-vibe">Save your shelf</h1>
      <p className="mt-1 text-sm text-on-vibe-muted">
        Sign in to keep your matches across devices. Anything you&apos;ve already swiped
        or saved comes with you.
      </p>

      {check_email && (
        <p className="mt-6 rounded-lg bg-tag-mood px-4 py-3 text-sm text-tag-mood-foreground">
          Check your email to confirm your account, then come back and sign in.
        </p>
      )}
      {error && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-6">
        <GoogleSignInButton />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-on-vibe-muted">
        <div className="h-px flex-1 bg-card-border" />
        or
        <div className="h-px flex-1 bg-card-border" />
      </div>

      <form className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded-lg border border-card-border bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={8}
          className="rounded-lg border border-card-border bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
        />
        <div className="mt-1 flex gap-2">
          <button
            formAction={signInWithPassword}
            className="flex-1 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground"
          >
            Sign in
          </button>
          <button
            formAction={signUpWithPassword}
            className="flex-1 rounded-full border border-card-border bg-card/70 px-6 py-2.5 text-sm font-medium text-foreground hover:border-accent"
          >
            Sign up
          </button>
        </div>
      </form>

      <Link href="/" className="mt-8 text-center text-sm text-accent underline">
        Keep browsing without an account
      </Link>
    </div>
  );
}
