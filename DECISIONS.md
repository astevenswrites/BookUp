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

---

*(Later phases append their own sections here as we build them.)*
