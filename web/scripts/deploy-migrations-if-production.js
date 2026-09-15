// Runs as part of `npm run build`. Vercel sets VERCEL_ENV to "production",
// "preview", or "development" — only a real Production build (a push to
// main) should apply migrations automatically. A Preview build (any other
// branch/PR, not yet reviewed) still points at the SAME database — this app
// has no separate staging Supabase project (DECISIONS.md D16) — so letting
// an unmerged branch's migrations run against it automatically would be its
// own risk. Skips silently (exit 0) for local `npm run build` too, since
// VERCEL_ENV is never set outside Vercel's own build environment.
const { execSync } = require("node:child_process");

if (process.env.VERCEL_ENV === "production") {
  console.log("VERCEL_ENV=production — running prisma migrate deploy...");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`Skipping prisma migrate deploy (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
}
