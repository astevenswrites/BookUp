// D57: the canonical site origin for anywhere a URL needs to leave the
// server (email confirmation links, the homepage QR code). Prefers
// `VERCEL_PROJECT_PRODUCTION_URL` — set by Vercel's own build/runtime
// environment, the same in every deployment (production or preview),
// never derived from the incoming request — over the request's own
// `Host`/`Origin` headers.
//
// That distinction matters here specifically: `signUpWithPassword` used to
// build `emailRedirectTo` from `headers().get("origin")`. Whoever calls a
// Server Action's underlying POST endpoint directly (not through a real
// browser click) controls every header on that request, `Origin` included
// — so that was effectively attacker-controlled input feeding into a link
// Supabase emails out. Using the platform-provided production domain
// instead removes that as a lever entirely, and happens to also match
// whatever's on Supabase's redirect-URL allow-list, which the per-request
// Host never reliably would across deployments anyway.
//
// Falls back to the request's own Host header only when
// VERCEL_PROJECT_PRODUCTION_URL is unset — i.e., local dev, where there's
// no meaningful trust boundary to defend and the fallback is what makes
// `localhost:3000` links work at all.
export function getSiteOrigin(requestHeaders: Headers): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}
