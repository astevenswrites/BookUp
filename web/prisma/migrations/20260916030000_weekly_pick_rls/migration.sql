-- D76: WeeklyPick (added after D56's blanket RLS pass) shipped without
-- Row Level Security — a new table doesn't inherit RLS from anything, each
-- one needs its own ENABLE statement. Same reasoning and same "zero
-- policies" choice as D56: this app talks to Postgres exclusively through
-- Prisma as the `postgres` role, which owns every table and has
-- rolbypassrls = true, so RLS has no effect on the app's own queries here
-- either — it only closes Supabase's auto-generated PostgREST Data API
-- (the anon/authenticated roles) off from this table.

ALTER TABLE "WeeklyPick" ENABLE ROW LEVEL SECURITY;
