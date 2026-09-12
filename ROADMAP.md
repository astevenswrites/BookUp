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

## Phase 0 — Foundations (setup, no user-facing features)

**Goal:** a working, deployed "hello world" skeleton with the right bones, so every later phase is additive.

- Repo init, tooling (TypeScript, linting, formatting), CI basics.
- Tech stack scaffold: Next.js app, Postgres schema tooling (e.g., Prisma/Drizzle), deployment pipeline (Vercel or equivalent) with a live placeholder URL.
- Core data model v1: `Book`, `User`, `Swipe`, `TBREntry` tables.
- Design system starter: color palette, typography, the book-card component shell (cover-dominant, responsive for desktop + mobile breakpoints per the research's card hierarchy).
- Synthetic seed generator: ~200–500 placeholder books with generated titles, authors, blurbs, genre/trope/mood/heat/pacing tags, and placeholder cover art — deliberately *messy* (varying blurb lengths, some missing covers/tags) so the UI isn't designed around unrealistically clean data.

**Exit criteria:** a deployed page that shows a stack of realistic-but-fake book cards (no swiping yet, no auth yet).

## Phase 1 — Core Swipe & Discovery Loop (MVP)

**Goal:** the addictive part — the thing that proves the concept.

- Swipe-card UX: cover-dominant card, mood/trope tag stack, one evocative line, comp-title hook, genre as secondary tag, content warnings behind a tap (per the discovery-signal hierarchy in the research).
- Swipe mechanics: left/right gestures on mobile web, click/keyboard on desktop; card-fly animation for immediate feedback.
- Anonymous-first flow: let people swipe before forcing signup (lower friction), then prompt account creation to save results.
- Basic onboarding "vibe quiz" (not a form): genre, tropes, heat level, pacing, emotional tone, content-warning opt-ins — framed as personality-quiz style questions per the research.
- Right-swipe → adds to a TBR list; left-swipe → excluded from future shows.
- Content-based matching v1: filter/rank the deck using onboarding quiz answers + tag metadata (no ML yet — deterministic scoring is fine here).
- Daily swipe cap for free/anonymous users (return-visit trigger, per dating-app research).

**Exit criteria:** a stranger can land on the site, take the vibe quiz, swipe through a deck that feels reasonably matched to their answers, and end up with a TBR list — all without an account. Auth is only needed to persist it.

## Phase 2 — Accounts, Persistence & TBR Management

**Goal:** give people a reason to come back tomorrow.

- Full auth (email + OAuth), account-linked TBR/swipe history.
- TBR list as a living shelf: mood-sorted view, "still interested?" periodic re-prompt, mark as reading/finished/DNF.
- "Today's Picks" — a curated, capped daily set that refreshes at midnight (urgency mechanic from Bumble/Tinder research).
- Mood-based re-matching entry point: "What do you feel like reading today?" quick-select at session start, temporarily reweights the deck.
- Basic profile page: quiz answers editable, swipe stats.

**Exit criteria:** a returning user sees a genuinely different, fresh "Today's Picks" each day and has a persistent, useful TBR shelf.

## Phase 3 — Smarter Matching (Algorithm Depth)

**Goal:** matches get visibly better with use, closing BookyCall's biggest gap.

- Behavioral signal capture: swipe speed, blurb-expand-before-swipe, detail-view taps — feed into the scoring model, not just the binary swipe.
- Collaborative filtering v1: "readers with similar taste also loved" using swipe/TBR overlap across users (needs a meaningful user base — can launch with a simple similarity join before investing in a real ML pipeline).
- Reading completion signal: let users mark finished/DNF; weight finished > added > swiped-right in the model.
- Weekly algorithmic "Your Shelf" drop (Spotify Discover Weekly analog) delivered in-app + optional email/push.
- "Super Match" flag — one high-intent signal per week (free), unlimited later as a premium feature.

**Exit criteria:** two users with different quiz answers get visibly different, well-differentiated decks, and matches improve measurably after ~20–30 swipes.

## Phase 4 — Retention Loops & Notifications

**Goal:** habitual daily/weekly use.

- Streak tracking (consecutive days swiped or read) with lightweight rewards.
- Seasonal/genre reading challenges.
- Notification strategy: max 1/day, state-aware copy ("this has been on your TBR for 3 days..."), user-controllable frequency — explicitly avoiding the notification fatigue the research flags as the top uninstall driver.
- Social share cards ("I just matched with ___") sized for Instagram/TikTok/X sharing — doubles as acquisition channel.
- Buddy-read / shared-shelf feature (lightweight — compare TBRs with a friend).

**Exit criteria:** notification opt-in rate and week-2 retention are trackable and the share-card flow actually produces shareable images.

## Phase 5 — Monetization

**Goal:** sustainable freemium revenue without alienating free users (research is explicit that restricting the baseline experience is the fastest way to churn).

- Freemium tiers per the research's translation table: free = 10–20 swipes/day, genre-only filters, weekly picks; premium = unlimited swipes, full trope/mood/heat/pacing/CW filters, unlimited Super Matches, daily curated + early-access/ARC picks, full catalog depth.
- Payment integration (Stripe), subscription management.
- Author/publisher side (optional, later sub-phase): paid listing/boost placements — the B2B model that funded BookyCall — only if/once reader-side traction justifies building a publisher-facing product.

**Exit criteria:** a free user can subscribe, immediately feel the premium filters/unlimited swipes difference, and cancel without friction.

## Phase 6 — Community & External Integration

**Goal:** the social/discovery layer no competitor has combined with swipe UX.

- Goodreads/StoryGraph import (CSV or API) to bootstrap taste profiles for new users — the highest-value cold-start signal per the research.
- Public/shareable profile or "shelf" pages.
- Reading challenge leaderboards, buddy-read comment threads.
- Feedback channel in-app for feature requests (avoids BookyCall's stagnation trap).

**Exit criteria:** a new user can import their Goodreads history and get a meaningfully better first deck than a cold start.

## Phase 7 — Native Mobile Apps

**Goal:** iOS/Android, once the web product's core loop, algorithm, and monetization are validated.

- React Native (or equivalent) app sharing backend/API and as much logic as possible with the web app.
- Push notifications (native), App Store/Play Store listings.
- Parity pass on swipe gestures, card design, and offline-friendly TBR viewing.

**Exit criteria:** feature parity with the web app's core loop, published to both stores.

---

## Ongoing / Cross-Phase Threads (not a single phase, revisit throughout)

- **Real catalog sourcing** (new, deliberately deferred): before any public launch, decide how real book data gets in — options are (a) fair-use-style thumbnail covers + short excerpt blurbs with attribution/backlinks (the Goodreads/BookyCall approach), (b) a formal data licensing agreement with a metadata provider, or (c) editorial/user-generated cover art and original blurb copy to sidestep the issue entirely. This should be resolved before Phase 1 exits into anything public-facing with real titles, not before — placeholder data is fine for internal build/test.
- **Primary research gaps** flagged in the research doc (BookyCall churn interviews, willingness-to-pay, quiz A/B tests, notification tolerance, social feature demand) — worth running lightweight surveys/interviews once there's a real user base to ask, likely starting around Phase 2–3.
- **Content/catalog growth**: editorial trope/mood/heat/pacing tagging is the thing no API gives you for free — decide early whether this is manual (you/a small team), crowdsourced (user-submitted tags, StoryGraph-style), or NLP-assisted extraction from blurbs/reviews, and revisit as catalog size grows.
- **Naming/branding**: pick before Phase 1 ships anything with a public URL people might share.

---

## Suggested Immediate Next Step

Start **Phase 0**: scaffold the Next.js + Postgres project, set up the data model, and generate ~200–500 synthetic placeholder books so we have realistic-but-fake content to design the swipe-card UX against. Real catalog sourcing (and its licensing decision) is deliberately deferred — see "Real catalog sourcing" above.
