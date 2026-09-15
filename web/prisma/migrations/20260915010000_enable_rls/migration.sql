-- D56: lock down every application table with Row Level Security.
--
-- This app talks to Postgres exclusively through Prisma using the
-- `postgres` role. Confirmed directly against production: that role owns
-- every table here and has rolbypassrls = true, meaning RLS has zero effect
-- on it — this migration cannot break the app's own queries.
--
-- Its actual effect is closing Supabase's auto-generated PostgREST Data
-- API: without RLS, the public `anon` key (shipped in every browser bundle)
-- can read and write these tables directly via
-- https://<project>.supabase.co/rest/v1/<table>, bypassing every
-- actorWhere()-scoped check in src/app/actions.ts entirely. No policies are
-- defined below on purpose — an RLS-enabled table with zero policies denies
-- all access to every role except the owner, which is exactly the
-- "deny the anon/authenticated API roles, keep the app (owner) working"
-- split needed here. If a legitimate client-side Supabase use case ever
-- shows up, add narrow policies then rather than leaving this open until it
-- does.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Book" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Swipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TBREntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Preference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PreferenceTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyPick" ENABLE ROW LEVEL SECURITY;
