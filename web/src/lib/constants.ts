// Pure constants only — no server-only imports (Prisma, etc.) here.
// This file is safe to import from Client Components. See lib/limits.ts for
// the DB-backed logic that uses this constant server-side.

// D28: 35 swipes/day for accounts (free tier) — see DECISIONS.md D28 for the
// product-philosophy reasoning behind this number.
export const DAILY_SWIPE_CAP = 35;

// D42: an anonymous (pre-account) session gets a small one-time taste of
// real matching before hitting the signup wall — not a recurring daily
// allowance like DAILY_SWIPE_CAP above, which only applies once signed in.
// See DECISIONS.md D42 for why this replaces "anonymous users get the full
// daily cap" (D22/D28's original stance).
export const ANONYMOUS_PREVIEW_SWIPE_CAP = 5;
