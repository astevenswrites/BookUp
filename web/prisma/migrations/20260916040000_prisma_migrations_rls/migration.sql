-- D77: Supabase's live Security Advisor flagged "_prisma_migrations is
-- public, but RLS has not been enabled" — a real gap D56/D76 both missed.
-- Wrong assumption both times: that a framework-internal bookkeeping table
-- (migration name/checksum/timestamp, not application data) wasn't part of
-- "every table" worth locking down. But PostgREST doesn't care whether a
-- table is Prisma-model-defined or framework-created — it exposes anything
-- in the `public` schema the same way, and this table lives in `public`
-- like everything else. Without RLS, the anon key could read migration
-- history (mildly informative: internal schema-change naming/timing) and,
-- more importantly, could write to it — deleting or altering the row that
-- records a migration as applied wouldn't undo the actual schema change,
-- but would confuse Prisma's own migration-state tracking on a later
-- deploy. Same fix, same reasoning as every other table (D56/D76): the
-- app's `postgres` role owns this table too and has rolbypassrls = true,
-- so this only closes the PostgREST anon/authenticated path, never
-- Prisma's own access to its own bookkeeping table.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
