"use client";

import { useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    const supabase = createClientSupabaseClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // Browser navigates away to Google on success; isLoading only matters
    // if signInWithOAuth itself throws before that happens.
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="flex w-full items-center justify-center gap-2 rounded-full border border-card-border bg-card px-6 py-2.5 text-sm font-medium text-foreground hover:border-accent disabled:opacity-50"
    >
      Continue with Google
    </button>
  );
}
