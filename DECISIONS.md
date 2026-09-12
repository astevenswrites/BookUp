# Build Decisions Log

Running record of decisions made at each step, tied back to [research/market-research-2026-06.md](research/market-research-2026-06.md) and [ROADMAP.md](ROADMAP.md). The goal: surface the research-linked fork-in-the-road *before* building each piece, so we don't discover a structural mismatch three phases later. Newest entries at the bottom of each phase section.

---

## Phase 0 — Foundations

### D1. Tags are relational (`Tag` + `BookTag` join), not flat strings/JSON
- **Research link:** Pillar 3.2/3.4 — tropes, mood, and content warnings (not genre) are the dimensions readers actually filter/match on, and Phase 5's premium tier is specifically "unlock granular filtering by trope, mood, heat, pacing, CW" while free tier is "genre only."
- **Choice:** `Tag` table with a `category` field (`genre` | `trope` | `mood` | `content_warning`), joined to `Book` via `BookTag`.
- **Why not flat strings:** A comma-separated or JSON string field would make Phase 1's "genre-only free filter vs. full-tag premium filter" and Phase 3's content-based matching (scoring by tag overlap) require a data migration to become queryable. Relational from the start costs almost nothing now and avoids that rewrite.
- **Alternative considered:** JSON column — rejected only because it's harder to query/aggregate and this app's whole value prop is tag-driven matching, so tags deserve to be first-class rows, not an opaque blob.

### D2. Heat level and pacing are scalar fields on `Book`, not tags
- **Research link:** Pillar 3.2 — the 2022 MM Romance Reader Survey treats heat/angst and pacing as single-value spectra (e.g., "38% prefer high heat"), not multi-select categories like tropes.
- **Choice:** `heatLevel` and `pacing` are proper Prisma `enum` fields on `Book` (not `Tag` rows). Originally scoped as plain strings under an assumed SQLite constraint (see D8 — SQLite has no native enum support); once we moved to `prisma dev`'s local Postgres, switched to real enums for compile-time type safety in the generated client.
- **Why:** Keeps the UI mental model correct from the start — Phase 1's onboarding quiz needs these as sliders, not checkboxes, and mixing them into the `Tag` table would make "slow burn" and "enemies-to-lovers" look like the same kind of thing when they aren't. Native enums also mean a typo like `"slow_brun"` fails at the TypeScript level, not silently at write time.

### D3. Swipes and TBR entries support anonymous users from day one
- **Research link:** Phase 1's own exit criteria (research-derived, from the dating-app UX section on minimizing signup friction): "a stranger can swipe... without an account."
- **Choice:** `Swipe.userId` and `TBREntry.userId` are nullable; both carry a `sessionId` (an anonymous client-generated token) so pre-auth activity can be reconciled to a real `User` at signup time in Phase 2.
- **Why decide now:** Retrofitting anonymous support after Phase 2 ships accounts would mean migrating existing rows and rewriting every query that currently assumes `userId` is required. Building the nullable/session-hybrid shape now costs one extra column.

### D4. `TBREntry.status` uses the full lifecycle now, even though Phase 1 only uses one value
- **Research link:** Pillar 3.4/3.5 — reading completion is called out as "the highest-quality signal available" for the matching algorithm (Phase 3), and Phase 2's TBR shelf needs reading/finished/DNF states.
- **Choice:** `status` field with values `TO_READ | READING | FINISHED | DNF` from the first migration, even though Phase 1's UI only ever writes `TO_READ`.
- **Why:** This is a deliberate exception to "don't build for hypothetical future needs" — a `status` column is nearly free to add now and a genuinely painful backfill later (every existing TBR row would need a default status retrofitted, and any Phase 1 code that assumed a boolean "on shelf or not" would need rewriting). Small schema cost, real future cost avoided.

### D5. Deferred (flagged, not building yet): per-swipe behavioral signals
- **Research link:** Pillar 3.4 — swipe speed, blurb-expand-before-swipe, and detail-view taps are called out as richer signals than a binary swipe for Phase 3's matching engine.
- **Choice:** *Not* adding `msToDecision`/`viewedDetail`-style columns to `Swipe` in Phase 0.
- **Why:** Unlike D3/D4, there's no Phase 1 UI that produces this data yet, and the exact shape of "behavioral signal" is likely to change once we've actually built the swipe interaction and can see what's cheap to instrument client-side. Adding speculative columns now risks guessing the wrong shape twice. Revisit explicitly at the start of Phase 3.

### D6. Cover images are files referenced by URL, not inline data
- **Research link:** Pillar 3.1 — cover art is the dominant discovery signal (~73–74% of perceived value), so the card design and data shape both need to treat it as a first-class, always-present asset.
- **Choice:** Placeholder covers are generated as static SVG files (served from `/public` or a route), and `Book.coverUrl` stores a path/URL string — the same shape a real CDN/S3 URL will have later.
- **Why:** Keeps the "swap placeholder covers for real ones" step (the deferred "Real catalog sourcing" thread) a data-only change, not a schema or rendering-code change.

### D7. Comp titles stay a free-text field, not a structured Book-to-Book relation
- **Research link:** Pillar 3.1 — "if you liked X, you'll love Y" is a high-signal discovery hook.
- **Choice:** `Book.compTitle` is a plain string (editorial-authored sentence), not a self-referential relation to other `Book` rows.
- **Why:** A structured comp-title graph would be genuinely useful for Phase 3/6 (graph-based "explore similar" features), but we don't have real editorial content yet to populate it meaningfully, and it can be added later as an additive join table without touching existing data. Unlike D3/D4, deferring this doesn't force a shape change later — it's purely additive. Revisit when real catalog sourcing is decided.

### D8. Local dev database: `prisma dev` (local Postgres-compatible), not SQLite
- **Research link:** none directly — this is a pure tooling/environment decision, but it interacts with D1/D2 (relational tags, scalar heat/pacing fields) and the stack assumption in ROADMAP.md that production is Postgres.
- **Choice:** Use `prisma dev` (Prisma's own local Postgres-compatible dev database, no Docker/native build required) instead of SQLite via `@prisma/adapter-better-sqlite3`.
- **Why:** `better-sqlite3` requires a native compile step (`node-gyp`) that needs Visual Studio Build Tools with the C++ workload — not installed on this machine, and a heavy multi-GB install to add just for a dev-only database. `prisma dev` needs no native toolchain and, critically, means local dev runs against the *same* database engine as production (Postgres) — SQLite's lack of native enums and scalar list (`String[]`) support was already a known limitation we'd have had to work around (see D2) and then re-verify against real Postgres before shipping. Removes an entire category of "worked in dev, broke in prod" risk.
- **Alternative considered:** Install Visual Studio Build Tools to compile `better-sqlite3` — rejected as disproportionate setup cost for a dev-only concern when a same-engine alternative exists with no install step.

### D9. Book card enforces the discovery-signal hierarchy structurally, not just via page CSS
- **Research link:** Pillar 3.1's Discovery Signal Hierarchy table — cover art (~73–74% of perceived value) dominant, mood/trope tags immediately below it, one evocative line, comp title, genre as a secondary tag, rating/match-% small at the bottom, page count off-card entirely.
- **Choice:** `BookCard` is built as ordered, distinctly-styled slots matching that exact hierarchy (full-bleed cover → title/author → mood+trope tag stack → hook line → comp title → secondary genre chip → tap-to-expand detail), rather than a generic "card with some fields" component styled ad hoc per page. Heat level and pacing are deliberately *not* shown on the card face — the research places them as onboarding/filter dimensions (Pillar 3.2), not among the card-face discovery signals in the Pillar 3.1 hierarchy table, so they live in the detail expand instead. Similarly, no match-quality/rating indicator is shown yet, since Phase 0 has no matching algorithm — faking a number here would be worse than omitting it; add it in Phase 3 once it means something.
- **Why decide now:** This is the single component every later phase touches (swipe mechanics in Phase 1, "Super Match" badges in Phase 3, premium filter highlighting in Phase 5). Getting the visual weighting structurally correct now means later phases add to the card, they don't re-architect it.

### D10. Content warnings are tap-to-reveal from the first version of the card, not added later
- **Research link:** Pillar 3.2 — ~14% of readers actively avoid content warnings (spoiler concern) while ~37% specifically want them; the research's explicit design implication is "accessible via one tap, not displayed by default on the card face."
- **Choice:** Content warnings render behind a small expand control (a `'use client'` component) from day one, even though Phase 0 has no other interactivity.
- **Why:** Changing "always-visible text" to "hidden-by-default interactive reveal" later is a UX-perception change as much as a code change — easier to establish the right default now than to retrofit it after users have gotten used to something else.

### D11. Card is one responsive component, not separate desktop/mobile variants
- **Research link:** the product thesis itself — responsive web now, native apps later — and nothing in the research suggests the swipe-card paradigm should look structurally different by device, just scaled.
- **Choice:** Single `BookCard` component using responsive Tailwind classes, not two components or a device-detection branch.
- **Why:** Avoids duplicating card logic (and duplicating every future change to it) across two implementations.

### D12. Phase 0 displays cards in a review grid, not the literal swipe stack
- **Choice:** The Phase 0 homepage renders seeded books in a responsive grid for visual review, not the one-at-a-time overlapping stack. Swipe/stack mechanics are still scoped to Phase 1 per the roadmap — no gesture library added yet.
- **Why:** Phase 0's job is to validate the card design across many books and breakpoints at once, which a grid does better than a single-card view; building swipe/drag interaction now would be scope creep ahead of Phase 1.

### D13. Color palette and title typeface are explicitly placeholder pending branding
- **Choice:** A warm, neutral "bookish" palette (parchment background, deep plum/ink accents) and a serif display font for titles — chosen for aesthetic plausibility only, not tied to any research finding.
- **Why flagged:** ROADMAP.md's "Naming/branding" thread is still open. This is the one design decision in this step that isn't research-derived and should be expected to change once a name/brand direction is picked — noted so it isn't mistaken for a considered brand decision later.

### D14. `Book` needs a separate `hookLine` field distinct from `blurb`
- **Research link:** Pillar 3.1 treats "a single evocative sentence" as its own primary card-face element, distinct from the full blurb/synopsis (which the research and the Hinge-prompt analogy in Pillar 2.1 treat more like detail-view content revealed on further interest, not the initial hook).
- **Choice:** Added `Book.hookLine` (short, punchy, card-face text) alongside the existing `Book.blurb` (longer, shown in the tap-to-expand detail view). Migrated now, before any real editorial content exists.
- **Why decide now:** This is exactly the kind of gap that's cheap to fix in Phase 0 (one migration, regenerate synthetic seed data) and expensive later (would mean writing a second line of editorial copy for every real book already catalogued, or an awkward one-time NLP-extraction pass to backfill it from existing blurbs).

### D15. Hosting: Vercel for this app, kept separate from the Cloudflare-hosted author site
- **Choice:** Deploy this app to Vercel on its own (subdomain or separate domain), not onto the same Cloudflare setup as the existing author website.
- **Why:** Different product, different concerns. Next.js 16 is very recent, and Cloudflare's OpenNext adapter for Next.js tends to lag Vercel's native (Vercel is Next.js's own company) support by a version or two — deploying separately avoids that adapter-compatibility risk and keeps the two sites from being coupled operationally (a bad deploy or config change on one can't take down the other).

### D16. Production database/auth: a new, dedicated Supabase project — not the existing beta-reader-portal one
- **Choice:** Create a separate Supabase project under the same account already used for the author site's beta reader portal, rather than adding tables to that existing project.
- **Why:** Supabase bundles Postgres + Auth (GoTrue), which conveniently covers two separate stack assumptions from ROADMAP.md at once (managed Postgres, and Phase 2's auth provider — Auth.js/Clerk is no longer needed as a separate piece). But the beta-reader-portal's users and this app's readers are unrelated identities; sharing a project would couple two products' data models, migrations, and auth contexts for no benefit. Same account, isolated project — no data ever crosses between them.

### D17. Two different Postgres connection strings needed: pooled (runtime) vs. direct (migrations)
- **Research link:** none — pure infrastructure gotcha, flagged now so it isn't discovered mid-deploy.
- **Choice:** When wiring up the new Supabase project, use Supabase's **connection pooler** URL (port 6543, PgBouncer) for `DATABASE_URL` at runtime, and the **direct connection** URL (port 5432) specifically for running `prisma migrate deploy`.
- **Why decide now:** Vercel runs this app as serverless functions, which can each open their own Postgres connection — without pooling, a moderate amount of traffic can exhaust Supabase's direct connection limit. Prisma Migrate, on the other hand, needs the direct connection (the pooler doesn't support all the session-level operations migrations require). Getting this wrong doesn't show up in local dev (single long-lived `prisma dev` connection) — it shows up as intermittent "too many connections" errors in production, which is a much worse time to discover the distinction.

### D18. Migrations use Supabase's Session Pooler, not the literal "direct connection" host
- **Choice:** `DIRECT_URL` (used by `prisma migrate deploy`) points at Supabase's pooler host on port 5432 (**Session mode**), not the `db.<project-ref>.supabase.co:5432` host that Supabase's dashboard also lists as the "direct connection."
- **Why:** Confirmed by hitting it directly — Supabase's literal direct-connection host is IPv6-only by default on newer projects, and connection attempts from this network (and likely Vercel's build environment too) fail outright (`P1001: Can't reach database server`) rather than falling back to IPv4. The Session Pooler is IPv4-reachable and still supports the session-level SQL operations migrations need (unlike the Transaction Pooler on port 6543, which is runtime-only — see D17). So in practice there are three Supabase connection strings, not two: **Session Pooler (5432)** for migrations, **Transaction Pooler (6543, `?pgbouncer=true`)** for app runtime, and the literal direct host is not used at all in this deployment.
- **How to apply:** Both `DATABASE_URL` and `DIRECT_URL` in Vercel's env vars should use the `<region>.pooler.supabase.com` host (from D17/.env.example) — never the `db.<ref>.supabase.co` host, even though Supabase's own dashboard presents that as the default "direct connection" option.

### D19. Synthetic catalog generation and DB loading must be split into separate steps
- **Discovered via:** the first production deploy — cover images were broken on Vercel. Root cause: `seed.ts` both *generated* fresh random data and *wrote it to whichever DB it was pointed at*, in one non-deterministic step. Running it once for local dev and again for production produced two different random catalogs with two different sets of randomly-named cover files. Local's generated SVGs lived only on the local filesystem (and were gitignored besides), so they never reached the Vercel deploy at all, and even if they had, the filenames wouldn't have matched production's database rows.
- **Choice:** Split into two scripts. `generate-catalog.ts` (run manually, occasionally) generates the synthetic books + cover SVGs *once* and writes them to a committed fixture (`prisma/seed-data/catalog.json` + `public/covers/*.svg` — both now tracked in git, not gitignored). `seed.ts` (the actual `prisma db seed` entrypoint) just *loads* that fixed fixture into whatever database it's pointed at — deterministic, identical across local/production/any future environment, because the cover files it references are committed and travel with the deploy.
- **Why decide now, not patch around it:** A quick fix (just commit whatever's currently in local `public/covers`) would still leave local and production with mismatched catalogs after the next reseed, and would resurface the identical bug the next time anyone regenerates data. Separating "create the placeholder content" from "load it into a database" is the actual fix, and it's a small refactor now versus a recurring source of "why are covers broken again" later.
- **Accepted tradeoff:** `seed.ts` clears the `Book` table before reloading the fixture, which is intentionally destructive — acceptable only because this synthetic catalog is explicitly temporary (see ROADMAP.md's deferred "Real catalog sourcing" task) and no real users exist yet to have swipe/TBR history attached to these rows. **This must not run against production again once Phase 1 ships real anonymous swipe data** — revisit this script's safety before then.

---

*(Later phases append their own sections here as we build them.)*
