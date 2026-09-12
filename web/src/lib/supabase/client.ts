import { createBrowserClient } from "@supabase/ssr";

// Browser-side client — used from Client Components (the login form's
// "Continue with Google" button, which needs to redirect the whole page).
export function createClientSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
