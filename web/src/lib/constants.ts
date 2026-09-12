// Pure constants only — no server-only imports (Prisma, etc.) here.
// This file is safe to import from Client Components. See lib/limits.ts for
// the DB-backed logic that uses this constant server-side.

// D28: 35 swipes/day for free/anonymous users — see DECISIONS.md D28 for the
// product-philosophy reasoning behind this number.
export const DAILY_SWIPE_CAP = 35;
