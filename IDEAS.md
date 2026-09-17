# Brainstorm / Idea Log

A running scratch list for naming and terminology ideas — dating-app vocabulary
reimagined for books. Nothing here is decided; this is capture, not commitment.
Promote an idea to DECISIONS.md once it's actually chosen, or ROADMAP.md once
it's actually scheduled.

## App name alternatives (current: "BookUp")

The pun on "hook up" works but is a little flat on its own. Candidates, grouped
by angle:

**Dating-vocabulary puns**
- **Booked** — "I'm booked" (busy/taken) + literally about books. Single word, snappy.
- **Plot Twist** — a real dating-app moment *and* a real book term.
- **Bindr** — Tinder-style respelling + bookbinding. Legible instantly, but close enough to "Tinder" that it may read as derivative.
- **Meet Cute** — the actual romance-genre term for how leads meet. Strong for a romance-heavy catalog specifically.

**Book-community vocabulary**
- **TBR** — "to be read," already used in-app as a shelf name. Insider language rather than explaining the concept.
- **Currently Reading** — the Goodreads status phrase.
- **Well Read** — double meaning: literate, and "he read me well."

**Playful coinages**
- **Shelfie** — selfie + bookshelf. Check for naming collision — at least one existing book-cataloging app uses this.
- **Spark Notes** — spark (romantic) + the study-guide brand. Clever, but SparkNotes is a real trademark — risky to actually ship.
- **Inkling** — literary and warm; doesn't announce "dating app" the way the others do.

**Literal but cheeky**
- **Between the Covers** — book covers / bed covers double entendre. Flirtier than BookUp — matches the heat-level filtering, but a bigger tonal swing.
- **Dog-Eared** — the term for a well-loved, well-worn book. Cozier, less dating-coded.

## Feature/terminology ideas

Dating-term wordplay for in-app concepts (tags, shelves, prompts) — not just the
app name itself.

- **"Books with Benefits"** (2026-09-16) — play on "friends with benefits." The
  concept: books you come back to periodically as a guilty pleasure/comfort
  re-read — not necessarily your favorite or highest-rated, just the one you
  keep returning to. Proposed as a taggable dimension alongside the existing
  `trope`/`mood` tag categories (see `TagCategory` in `web/prisma/schema.prisma`,
  currently `genre` / `trope` / `mood` / `content_warning`).
  - Open question: a full new `TagCategory` value, or just a label within an
    existing category (e.g. a `mood` tag like "comfort read")? A new category
    implies its own UI treatment (its own badge color, its own quiz question,
    its own filter) — worth deciding once there's a second idea in this
    category to see if a pattern's actually forming, rather than building
    the scaffolding for a category of one.
  - Open question: is this a **book-level tag** (curated/inferred per book, like
    trope/mood) or a **user-level signal** (a shelf a reader builds themselves,
    like TBR)? "Guilty pleasure" is inherently personal — the same book could
    be a comfort reread for one person and unremarkable for another — which
    leans toward a user shelf rather than an objective book tag. Worth
    resolving before building either.
