# Book Dating App — Build Roadmap

Basis: [research/market-research-2026-06.md](research/market-research-2026-06.md). This doc translates that research into a phased build plan. Phases are meant to be built and shipped in order — each one should be usable/demoable on its own before moving to the next.

## Product Thesis (from research)

Occupy the gap no existing product fills: BookyCall's emotional swipe framing + StoryGraph's trope/mood granularity + Hinge's prompt-style engagement + a Spotify-style learning algorithm + a real social layer + freemium monetization that doesn't punish free users. Ship as a responsive website first (desktop + mobile web); native iOS/Android come later once the core loop is validated.

## Working Assumptions (flag if you want these changed)

- **Platform order**: responsive web app now, native apps later (Phase 7+), consistent with the original ask.
- **Stack**: Next.js (React) frontend + TypeScript, a Postgres database, a lightweight backend (Next.js API routes or a small Node/Express service) — this keeps one codebase that can later feed a React Native app with shared types/logic. Open to swapping if you have a stack preference.
- **Book data**: build and test against **synthetic/placeholder books** through Phase 0–1 rather than real metadata. Real covers and jacket-copy blurbs are copyrighted, and APIs like Google Books/Open Library are meant for linking back to their own listings, not for republishing content in a commercial UI — that's a licensing decision (fair-use thumbnails + attribution vs. a formal data agreement vs. user/editorial-generated art) worth making deliberately, not backing into while iterating on UI. See "Real catalog sourcing" under Ongoing Threads below.
- **Auth**: Supabase Auth (email + OAuth) rather than a separate provider like Auth.js/Clerk — see below.
- **Hosting**: Vercel (frontend), kept deliberately separate from the Cloudflare-hosted author website — see DECISIONS.md D15.
- **Database/Auth provider**: a new, dedicated **Supabase project** (Postgres + Auth bundled) under the same Supabase account already used for the author site's beta reader portal — a separate project, not shared tables. See DECISIONS.md D16/D17 for why, and the connection-pooling gotcha to get right at deploy time.
- **Name**: placeholder "the app" for now — worth deciding before Phase 1 ships anything public-facing, but doesn't block engineering.

These are defaults chosen to minimize cost/complexity for a solo-founder-style build. Say the word if you want a different stack, data source, or hosting choice before Phase 1 starts.

---

## Phase 0 — Foundations (setup, no user-facing features) — ✅ Done

**Goal:** a working, deployed "hello world" skeleton with the right bones, so every later phase is additive.

- Repo init, tooling (TypeScript, linting, formatting), CI basics.
- Tech stack scaffold: Next.js app, Postgres schema tooling (e.g., Prisma/Drizzle), deployment pipeline (Vercel or equivalent) with a live placeholder URL.
- Core data model v1: `Book`, `User`, `Swipe`, `TBREntry` tables.
- Design system starter: color palette, typography, the book-card component shell (cover-dominant, responsive for desktop + mobile breakpoints per the research's card hierarchy).
- Synthetic seed generator: ~200–500 placeholder books with generated titles, authors, blurbs, genre/trope/mood/heat/pacing tags, and placeholder cover art — deliberately *messy* (varying blurb lengths, some missing covers/tags) so the UI isn't designed around unrealistically clean data.

**Exit criteria:** a deployed page that shows a stack of realistic-but-fake book cards (no swiping yet, no auth yet).

## Phase 1 — Core Swipe & Discovery Loop (MVP) — ✅ Done

**Goal:** the addictive part — the thing that proves the concept.

- Swipe-card UX: cover-dominant card, mood/trope tag stack, one evocative line, comp-title hook, genre as secondary tag, content warnings behind a tap (per the discovery-signal hierarchy in the research).
- Swipe mechanics: left/right gestures on mobile web, click/keyboard on desktop; card-fly animation for immediate feedback.
- Anonymous-first flow: let people swipe before forcing signup (lower friction), then prompt account creation to save results.
- Basic onboarding "vibe quiz" (not a form): genre, tropes, heat level, pacing, emotional tone, content-warning opt-ins — framed as personality-quiz style questions per the research.
- Right-swipe → adds to a TBR list; left-swipe → excluded from future shows.
- Content-based matching v1: filter/rank the deck using onboarding quiz answers + tag metadata (no ML yet — deterministic scoring is fine here).
- Daily swipe cap for free/anonymous users (return-visit trigger, per dating-app research).

**Exit criteria:** a stranger can land on the site, take the vibe quiz, swipe through a deck that feels reasonably matched to their answers, and end up with a TBR list — all without an account. Auth is only needed to persist it.

## Phase 2 — Accounts, Persistence & TBR Management — ✅ Done

**Goal:** give people a reason to come back tomorrow.

- Full auth (email + OAuth), account-linked TBR/swipe history.
- TBR list as a living shelf: mood-sorted view, "still interested?" periodic re-prompt, mark as reading/finished/DNF.
- "Today's Picks" — a curated, capped daily set that refreshes at midnight (urgency mechanic from Bumble/Tinder research).
- Mood-based re-matching entry point: "What do you feel like reading today?" quick-select at session start, temporarily reweights the deck.
- Basic profile page: quiz answers editable, swipe stats.

**Exit criteria:** a returning user sees a genuinely different, fresh "Today's Picks" each day and has a persistent, useful TBR shelf.

## Phase 3 — Smarter Matching (Algorithm Depth) — ✅ Done

**Goal:** matches get visibly better with use, closing BookyCall's biggest gap.

- [x] Behavioral signal capture: swipe speed, blurb-expand-before-swipe, detail-view taps — feed into the scoring model, not just the binary swipe. (D45, D49)
- [x] Collaborative filtering v1: "readers with similar taste also loved" using swipe/TBR overlap across users. (D46)
- [x] Reading completion signal: let users mark finished/DNF; weight finished > added > swiped-right in the model. (`TbrStatus`, D4)
- [x] Genre-alignment gate + multi-category coverage bonus, beyond what this phase originally scoped. (D65)
- [x] Two more discovery surfaces not in the original plan: Blind Date (a "surprise me" pick resembling your own taste) and Trending (community-wide popularity, independent of personal fit). (D48, D50)
- [x] Weekly algorithmic drop + "Super Match" — turned out to be one feature: `/weekly` shows the single top-scoring pick as "This Week's Super Match" plus 9 more as the drop, refreshed every ISO week. In-app only — the "optional email/push" half is explicitly deferred to Phase 4 (notifications infrastructure doesn't exist yet). (D75)

**Exit criteria:** two users with different quiz answers get visibly different, well-differentiated decks, and matches improve measurably after ~20–30 swipes. **Met** — this is genuinely working today.

## Phase 4 — Retention Loops & Notifications — 🚧 In progress, 2 of 5 done

**Goal:** habitual daily/weekly use.

- [x] Streak tracking (consecutive days swiped) with a 🔥 count on the home dashboard. Not built: milestone rewards — no economy/premium system yet for a reward to plug into. (D79)
- [ ] Seasonal/genre reading challenges.
- [ ] Notification strategy: max 1/day, state-aware copy ("this has been on your TBR for 3 days..."), user-controllable frequency — explicitly avoiding the notification fatigue the research flags as the top uninstall driver. The biggest lift left in this phase — needs real new infrastructure (an email service at minimum; web push needs a service worker), nothing like this exists yet.
- [x] Social share cards ("I just matched with ___") sized for general link-preview sharing (1200×630 — works across X/Discord/iMessage/etc.) — doubles as acquisition channel. A dedicated vertical Stories-format variant is a possible follow-up, not built. (D80)
- ~~Buddy-read / shared-shelf feature (lightweight — compare TBRs with a friend).~~ Redirected, 2026-09-16 (see "Social features: partner, don't compete" under Ongoing Threads) — not building a competing reading-group feature in-house. Scope this down when picked up: a light "others who matched with this book" surface, not a full buddy-read/shared-shelf system.

**Exit criteria:** notification opt-in rate and week-2 retention are trackable and the share-card flow actually produces shareable images.

## Phase 5 — Monetization — ⬜ Not started (pricing copy is real, billing isn't)

**Goal:** sustainable freemium revenue without alienating free users (research is explicit that restricting the baseline experience is the fastest way to churn).

Landing page already shows real Free/Premium pricing tiers (D41) — that's marketing copy only, no Stripe integration or subscription logic behind it yet.

- Freemium tiers per the research's translation table: free = 10–20 swipes/day, genre-only filters, weekly picks; premium = unlimited swipes, full trope/mood/heat/pacing/CW filters, unlimited Super Matches, daily curated + early-access/ARC picks, full catalog depth.
- Payment integration (Stripe), subscription management.
- Author/publisher side (optional, later sub-phase): paid listing/boost placements — the B2B model that funded BookyCall — only if/once reader-side traction justifies building a publisher-facing product.

**Exit criteria:** a free user can subscribe, immediately feel the premium filters/unlimited swipes difference, and cancel without friction.

## Phase 6 — Community & External Integration — ⬜ Not started

**Goal:** the social/discovery layer no competitor has combined with swipe UX.

- Goodreads/StoryGraph import (CSV or API) to bootstrap taste profiles for new users — the highest-value cold-start signal per the research.
- Public/shareable profile or "shelf" pages.
- Reading challenge leaderboards, buddy-read comment threads.
- Feedback channel in-app for feature requests (avoids BookyCall's stagnation trap).

**Exit criteria:** a new user can import their Goodreads history and get a meaningfully better first deck than a cold start.

## Phase 7 — Native Mobile Apps — ⬜ Not started

**Goal:** iOS/Android, once the web product's core loop, algorithm, and monetization are validated.

- React Native (or equivalent) app sharing backend/API and as much logic as possible with the web app.
- Push notifications (native), App Store/Play Store listings.
- Parity pass on swipe gestures, card design, and offline-friendly TBR viewing.

**Exit criteria:** feature parity with the web app's core loop, published to both stores.

---

## Ongoing / Cross-Phase Threads (not a single phase, revisit throughout)

- **Real catalog sourcing** — 🚧 in progress, local-dev only. Went with a fourth option the original three didn't anticipate: Open Library's bulk data dumps, rule-based tagging, `needsReview` flagged for human curation (D66). ~2,260 real books loaded and curated (featured picks, children's-book scrub, cover-quality passes — D70-D74) in the local dev database. **Not yet in production** — that's still a separate, explicit decision to make (D66), not something to back into.
- **Primary research gaps** (BookyCall churn interviews, willingness-to-pay, quiz A/B tests, notification tolerance, social feature demand) — still open, still blocked on a real user base.
- **Content/catalog growth** — landed on a hybrid: rule-based inference at import time + `needsReview`/human-curation flags (D66/D70-72), not crowdsourced or NLP-assisted. Revisit if manual review volume becomes the bottleneck.
- **Social features: partner, don't compete** (new, 2026-09-16) — buddy-reads, reading groups, and similar deep social features are explicitly *not* something to build in-house going forward. Established apps (Fable named specifically) already own that space; competing head-on would mean re-fighting a fight this app doesn't need to fight, and it cuts against the roadmap's own thesis of occupying the swipe/matching gap rather than rebuilding everything a general reading-social app already does. Direction instead: point users at a partner app for the deep social layer, while keeping a light, in-app "social proof" touch of our own — e.g., surfacing other readers who matched with a book someone's looking at, short of a full reading-group experience. **Open and unresearched:** the actual technical integration path (deep link? a real API partnership? Fable specifically, or social-reading apps generally?) — nothing here is decided, this is a direction to build toward, not a spec. Directly affects how Phase 4's "buddy-read / shared-shelf" item should be scoped when it's picked up — see that item's note.
- **Naming/branding** — still the placeholder "BookUp." Actively being reconsidered — see [IDEAS.md](IDEAS.md) for candidates. Still the one item on this list that blocks nothing technical but probably shouldn't ship past a wider audience unresolved.

---

## Suggested Immediate Next Step

Phases 0-2 are done and Phase 3 is essentially done (two minor items open — Super Match, a cadenced/pushed weekly drop). The real gap is **Phase 4 (retention loops & notifications)** — nothing there is built yet: no streaks, no notification strategy, no share cards, no buddy-read. That's also the natural next phase per the original plan, and this app doesn't yet give anyone a reason to come back on day 3 who hasn't already formed the habit on their own. Monetization (Phase 5) is a reasonable alternative next step if revenue timing matters more than retention right now — the pricing UI already exists, it just isn't wired to real billing.
