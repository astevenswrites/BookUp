import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client for Server Components, Server Actions, and Route
// Handlers. Server Components can't write cookies, so `setAll` there is a
// no-op wrapped in try/catch (per @supabase/ssr's documented Next.js App
// Router pattern) — session refresh actually happens in middleware.ts.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render — ignored; middleware.ts
            // refreshes the session cookie on the next request instead.
          }
        },
      },
    }
  );
}
