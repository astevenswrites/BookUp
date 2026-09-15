# Handoff: BookUp — vibe-reactive UI, taglines, and accounts

## Overview

Four screens for BookUp — landing, onboarding, browse, shelf — designed against the
existing `astevenswrites/BookUp` codebase (`web/`, Next.js App Router). Most of this is
a **modification of existing components**, not new construction. The landing page and
the account/premium tier are the only genuinely new surfaces.

The design's central move: the ambient "vibe glow" stops being a static, session-level
background and becomes a live response to what the reader is looking at.

## About the Design Files

`BookUp Mockups.dc.html` in this bundle is a **design reference created in HTML** — a
prototype showing intended look and behavior. It is not production code to copy. It
renders all four screens in one file with a screen switcher and a desktop/mobile toggle,
neither of which belongs in the product.

Recreate these designs in the existing Next.js + Tailwind v4 environment using the
established patterns already in `web/src` — server components for data, `"use client"`
only where interaction demands it, `motion/react` for gesture, CSS variables from
`globals.css` for color. Do not introduce a new styling approach.

## Fidelity

**High-fidelity.** Colors, typography, and spacing are final and match the tokens
already committed in `web/src/app/globals.css` and `web/src/lib/theme.ts`. The book
covers are the one exception: they are typographic placeholders standing in for the
generated SVGs in `web/public/covers/`. Use the real covers.

Copy is final and should be used verbatim, including the two taglines.

---

## 1. The vibe glow — modify `VibeBackground.tsx`, `theme.ts`, `globals.css`

This is the highest-value change and should be done first; everything else depends on it.

### 1a. Fix the gradient (bug in current code)

`buildVignetteGradient` in `web/src/lib/theme.ts` currently returns:

```
radial-gradient(ellipse at center, transparent 22%, ${light} 55%, ${base} 95%)
```

`radial-gradient` defaults to `farthest-corner` sizing, so `100%` lands past the box
edge at the horizontal and vertical midlines. Roughly a third of the base color is still
being painted when the element clips, producing **hard vertical and horizontal seams**
at the box boundary. This is visible today wherever the glow box is shorter than the
viewport diagonal.

Replace with:

```ts
export function buildVignetteGradient(colors: [string, string, string]): string {
  const [base, light] = colors;
  return `radial-gradient(ellipse farthest-corner at center, transparent 14%, ${light} 52%, ${base} 100%)`;
}
```

### 1b. Make the glow full-bleed

Current `VibeBackground.tsx` constrains the glow to a card-shaped box
(`min(640px, 90vw) × min(820px, 90vh)`). Per design direction, the feeling color should
run the whole page. Replace the inner sized div with a full-bleed layer:

- `position: absolute; inset: -4%; width: 108%; height: 108%`
  (the 4% overhang gives the drift animation room without revealing an edge)
- The outer wrapper keeps `pointer-events-none fixed inset-0 -z-10 overflow-hidden`
  and `aria-hidden`.

The transparent center (first stop at 14%) keeps content ground clear, so body copy
stays readable while color reaches all four corners.

### 1c. Cross-fade between themes

The glow must change smoothly, not cut. Render **all four theme layers at once**, each
with `opacity: 0` or the active opacity, and transition opacity:

```
transition: opacity .8s ease, transform .8s ease;
```

Gradients cannot be interpolated by CSS, so a single layer with a changing `background`
will jump. Four stacked layers cross-fading is the working approach.

### 1d. Drive the theme from the top card, not the session

Today `layout.tsx` derives one theme from the reader's quiz moods and holds it for the
whole session. Change to:

- **Browse**: theme derives from the **top card's** mood labels via the existing
  `deriveVibeTheme` / `MOOD_TO_FAMILY` map. It cross-fades on every swipe.
- **Onboarding**: theme derives from moods **as they are selected**, live, on the mood
  step. Most recently selected mood wins.
- **Shelf**: theme derives from the most recently added book.
- **Landing**: theme is driven by the interactive mood picker (see §2).

Mechanically this means the theme can no longer be computed server-side in
`layout.tsx` alone. Lift it into a client context provider (`VibeProvider`) mounted in
`layout.tsx`, seeded with the server-derived session theme as its initial value, and let
`SwipeDeck`, `Quiz`, and the landing page push updates into it. `VibeBackground`
consumes the context. `lib/theme.ts` stays pure and unchanged apart from 1a.

### 1e. React to drag

While a card is being dragged, scale the glow with gesture distance:

- `drag = min(abs(dragX) / 200, 1)`
- opacity multiplier: `1 + drag * 0.35`
- transform: `scale(1 + drag * 0.04)`

`SwipeDeck` already tracks `x` via `useMotionValue`. Subscribe to it and push the
normalized value into the vibe context — do not re-render the deck on every pointer move.

### 1f. Idle drift

Add to `globals.css`, alongside the existing `vibe-breathe`:

```css
@keyframes bu-drift {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  50%      { transform: translate3d(0,-14px,0) scale(1.03); }
}
```

Applied to the active layer at `18s ease-in-out infinite`. Keep this inside the existing
`@media (prefers-reduced-motion: no-preference)` guard, same as `vibe-breathe`.

---

## 2. Landing page — new, at `/` for signed-out visitors

Currently `/` renders the quiz for new sessions. Introduce a marketing landing ahead of
it; the quiz moves behind the CTA.

### Layout

- Desktop: hero is `grid-template-columns: 1.15fr .85fr`, `gap: 56px`, `align-items: center`,
  padding `26px 0 52px`. Page padding `44px 48px 56px`, `max-width: 1180px`.
- Mobile: single column, `gap: 28px`, page padding `26px 20px 40px`.

### Header

- Left: wordmark "BookUp" — Fraunces 600, 20px, `letter-spacing: -.02em`.
- Right: "Sign in" — pill, `1px solid #e7ded1`, `background: rgba(255,255,255,.7)`,
  `padding: 8px 16px`, `border-radius: 999px`, Geist 500 13px, `white-space: nowrap`.

### Hero copy (verbatim)

- Kicker: "A dating app, but for books" — Geist 500 12px, `letter-spacing: .14em`,
  uppercase, `#5b2a86`, `margin-bottom: 18px`.
- H1: **"Hook Up with BookUp"** — Fraunces 600, 68px desktop / 42px mobile,
  `letter-spacing: -.025em`, `line-height: 1.02`.
- Tagline: **"Get paired with your ideal book match!"** — Fraunces 400 *italic*,
  26px desktop / 20px mobile, `#5b2a86`, `margin-bottom: 20px`.
- Body: "Tell us the mood you're chasing, the tropes you'd swipe right on, and the things
  you'd rather not read about. We'll shuffle up books that match the feeling — and the
  whole page will start to look like it." — Geist 400 18px/1.6, `#4a4353`, `max-width: 30em`,
  `text-wrap: pretty`.
- CTAs: primary "Start the vibe check" (`#5b2a86` fill, white, 15px, `padding: 14px 26px`,
  `border-radius: 999px`, `box-shadow: 0 6px 20px rgba(91,42,134,.22)`) → routes to quiz.
  Secondary "Peek at the deck" (white 70%, `1px solid #e7ded1`) → routes to browse.
- Subline: "Free account, 35 swipes a day. Go premium when 35 stops being enough." —
  Geist 400 13px, `#6b6270`, `margin-top: 18px`.

### Interactive mood demo (right column)

A card — `rgba(255,255,255,.78)`, `1px solid #e7ded1`, `border-radius: 20px`,
`padding: 20px`, `backdrop-filter: blur(6px)`, `box-shadow: 0 10px 40px rgba(36,27,47,.08)`.

- Eyebrow: "Try it right here" — Geist 500 12px, `letter-spacing: .1em`, uppercase, `#6b6270`.
- Title: "Pick a feeling. Watch the page change." — Fraunces 19px/1.3.
- Four pills, one per vibe family: Cozy / Whimsical / Melancholy / Dark.
  Unselected: `1px solid #e7ded1`, `rgba(255,255,255,.7)`, `#241b2f`.
  Selected: `1px solid #241b2f`, `background: #241b2f`, `color: #faf6f0`.
  Geist 500 14px, `padding: 9px 16px`, `border-radius: 999px`, `transition: all .2s ease`.
- Caption changes with the selection:
  - cozy: "Warm amber, blanket weather, someone's making tea in chapter one."
  - whimsical: "Lilac and a little strange — the books that don't explain themselves."
  - melancholy: "Grey-blue and quiet. For when you want to feel something slowly."
  - dark: "Deep red. You already know what you're in for."

Clicking a pill sets the page's vibe theme. This is the product demonstrating itself and
is the reason the landing page earns its place — don't drop it.

### Plans

Two cards, `grid-template-columns: 1fr 1fr`, `gap: 24px` (stacked on mobile).

**Free** — `1px solid #e7ded1`, `rgba(255,255,255,.72)`, `border-radius: 18px`,
`padding: 24px`, `backdrop-filter: blur(6px)`. Badge "35 swipes a day"
(`#efe6da` / `#4a3f33`). Price "$0" Fraunces 600 32px.
- 35 swipes a day, refreshed each morning
- One shelf, sorted by vibe
- Full mood, trope and content-warning filters

**BookUp Premium** — `1px solid #5b2a86`, `rgba(255,255,255,.88)`,
`box-shadow: 0 10px 34px rgba(91,42,134,.16)`. Badge "For the voracious"
(`#f3e6f6` / `#5b2a86`). Price "$4/mo".
- Unlimited swipes — read the whole deck in one sitting
- Undo a pass you regret
- Separate shelves per mood, plus export
- First look at new releases matching your vibe

Bullets are a flex row: 5px `#5b2a86` dot, `margin-top: 7px`, `gap: 9px`, label Geist 400 14px/1.5 `#4a4353`.

> **Placeholder.** These features and the $4/mo price were invented for the mock and
> need product sign-off before shipping. "Undo a pass" is likely the strongest
> conversion driver for heavy swipers and may deserve top billing.

### How it works

Three columns, `gap: 36px`, each with a `2px solid #241b2f` top rule and `padding-top: 14px`.
Number (Geist 500 11px, `letter-spacing: .12em`, uppercase, `#6b6270`), title (Fraunces 17px),
body (Geist 400 14px/1.55, `#4a4353`).

1. **01 — Answer nine quick questions.** "Moods, tropes, heat, pacing, and the things you never want to read about. Two minutes, no account."
2. **02 — Swipe a deck built for you.** "Mood and trope matches count triple. Genre is a tiebreaker, not the whole point."
3. **03 — Your shelf sorts itself by feeling.** "Not alphabetical. Grouped by the vibe that made you save it in the first place."

> Note: step 01's "no account" line predates the account decision. Reword before shipping
> if sign-up now precedes swiping.

---

## 3. Onboarding — modify `Quiz.tsx`

Keep all nine existing steps, their copy, keys, and option sources exactly as they are.
Three changes:

### 3a. Add a tenth step: account creation

Appended after `content_warning`. `steps.length` becomes 10, so the progress bar and the
"Step N of 10" label follow automatically.

- Title: "Save your shelf."
- Subtitle: "Make an account so your matches are still here tomorrow. Free gets you 35 swipes a day, every day."
- Body: "Continue with Google" and "Continue with Apple" buttons — full width, left-aligned
  text, `1px solid #e7ded1`, `rgba(255,255,255,.9)`, `border-radius: 12px`, `padding: 13px 18px`,
  Geist 500 15px.
- An "or" divider: two 1px `#e7ded1` rules flanking Geist 400 12px `#6b6270`.
- Email and password inputs, same box treatment, `padding: 13px 16px`, placeholders
  "you@example.com" and "Pick a password".
- Footer strip above the nav, `border-top: 1px solid #e7ded1`, `padding-top: 14px`:
  a "Free plan" badge (`#efe6da` / `#4a3f33`) plus "35 swipes a day. Upgrade any time —
  you won't be asked again today."

The final button label changes from "Show me books" to **"Create account & start swiping"**.
On submit, create the account, then persist the preference via the existing `submitQuiz`
server action, then route to the deck.

Account is deliberately **last** — the taste questions do the selling before the ask. Do
not move it to the front.

### 3b. Live vibe response on the mood step

As moods are selected, push the derived family into the vibe context so the background
changes under the reader in real time. Below the chips, show a line in `#5b2a86`,
Geist 400 13px/1.5:

> "That's {cozy|whimsical|melancholy|dark} energy. The page is already listening."

Shown only on the mood step, only once at least one mood is selected.

### 3c. Progress bar

Existing bars are `h-1.5`; design uses 5px with `gap: 5px`, `border-radius: 999px`, and
`transition: background .3s ease`. Filled `#5b2a86`, empty `#e7ded1`.

---

## 4. Browse — modify `SwipeDeck.tsx` and `BookCard.tsx`

Card content, slot order, tag hierarchy, drag threshold (120px), stamp behavior, and the
35/day cap are all unchanged from the current implementation. Changes:

### 4a. Card stack motion

- Stack offset `top: index * 9px` (currently 8), scale `1 - index * 0.035` (currently 0.04).
- `transform-origin: 50% 90%` so rotation pivots low, like a real card being lifted.
- Settle transition `.45s cubic-bezier(.2,.9,.3,1)`, disabled while dragging.
- Card radius 18px, `box-shadow: 0 8px 30px rgba(36,27,47,.12)`.

### 4b. Cover block

Where a real cover isn't available, the cover area is a gradient from the book's own vibe
family: `linear-gradient(155deg, colors[0] 0%, colors[2] 100%)`, min-height 230px, with
the title in Fraunces 23px/1.2 `#faf6f0`, author in Geist 12px uppercase
`rgba(250,246,240,.7)`, and a 44×2px `rgba(250,246,240,.5)` rule pinned to the bottom.
**Use `web/public/covers/*.svg` instead when present** — this treatment is the fallback.

### 4c. Button row

Pass and Like buttons are 58px circles either side of a 120px centered hint label
(Geist 400 12px `#6b6270`) reading "or drag the card", switching to "keep going…" while
dragging. Like: `#5b2a86` fill, `box-shadow: 0 6px 18px rgba(91,42,134,.28)`.

### 4d. Desktop "Why this one" rail — new

Desktop only (hidden on mobile), 300px fixed, `padding-top: 46px`, sitting 44px right of
the deck. Card: `rgba(255,255,255,.8)`, `1px solid #e7ded1`, `border-radius: 18px`,
`padding: 20px`, `backdrop-filter: blur(6px)`.

- Eyebrow "Why this one".
- One row per matching tag, `padding: 7px 0`, `border-bottom: 1px solid #efe8de`:
  an 8px dot (mood `#234a63`, trope `#5b2a86`, genre `#4a3f33`), the label, and the
  weight right-aligned in Geist 500 12px `#6b6270`.
- Weights come from `CATEGORY_WEIGHT` in `lib/matching.ts` — mood ×3, trope ×3, genre ×1.
  Read them from that constant; do not hardcode, so the rail stays honest if scoring changes.
- Below: "Vibe reading" with a 24px gradient swatch of the active family, its label in
  Fraunces 18px, and "The glow behind the page is reading this card. Swipe and the room
  changes with it."

### 4e. Cap state upgrade prompt

When `remaining <= 0`, keep the existing "That's today's matches!" heading and shelf
count, then add below it a card — `1px solid #5b2a86`, `rgba(255,255,255,.85)`,
`border-radius: 16px`, `padding: 20px`, left-aligned:

- "Not done reading?" — Fraunces 18px
- "Premium takes the cap off — swipe the whole deck, undo a pass, and keep a shelf per mood." — Geist 400 14px/1.5 `#4a4353`
- Button "Go Premium — $4/mo" — `#5b2a86` fill, Geist 500 14px, `padding: 11px 22px`, pill

This is the moment the limit is actually felt, so it is the right place for the upsell —
not an interstitial earlier in the session.

---

## 5. Shelf — modify `app/tbr/page.tsx`

Replace the flat `grid-cols-1 sm:2 lg:3 xl:4` with **grouping by vibe family**, in the
order `cozy, whimsical, melancholy, dark`. Empty groups are omitted.

Each group header: `border-top: 2px solid #241b2f`, `padding: 12px 0 16px`, containing a
14px circular swatch (`linear-gradient(135deg, colors[0], colors[2])`), the family label
in Fraunces 19px, and a count in Geist 400 13px `#6b6270` ("3 books" / "1 book").

Group grid: `repeat(auto-fill, minmax(220px, 1fr))` desktop, `minmax(150px, 1fr)` mobile,
`gap: 16px`. Cards are a compact `BookCard` — 14px radius, gradient cover block
(min-height 130px, 16px padding), hook line Geist 500 14px/1.35, and two tag chips.

Header: "Your shelf" Fraunces 600 36px; subline "{n} books you matched with, grouped by
the feeling." Empty state: dashed `#d9cfc0` border, 18px radius, `padding: 44px 24px`,
centered — "Nothing here yet." / "Swipe right on a few books and they'll land here,
sorted by the feeling that made you save them."

---

## Interactions & Behavior

| Trigger | Result |
| --- | --- |
| Landing mood pill click | Vibe theme changes, caption swaps. 800ms cross-fade. |
| Quiz mood selection | Vibe theme follows most recent selection, live. Echo line appears. |
| Quiz step advance | Progress bar fills, 300ms. Single-choice steps gate "Next"; text and multi steps are optional. |
| Card drag | Card translates and rotates (`dragX/200 × 12deg`); glow brightens and scales with distance; TO READ / PASS stamps fade in from 20px to 120px of travel. |
| Drag release past ±120px | Commits swipe; next card's vibe cross-fades in. |
| Drag release under threshold | Card springs back, `.45s cubic-bezier(.2,.9,.3,1)`. |
| Swipe right | Book appends to shelf; shelf count increments. |
| Deck exhausted / cap hit | Premium prompt. |

Honor `prefers-reduced-motion` throughout: the drift and breathe animations already sit
behind that guard in `globals.css`; the opacity cross-fade is safe to keep.

## State Management

Existing `SwipeDeck` state (deck, remaining, seenIds, tbrCount) and `Quiz` state
(stepIndex, multiSelections, singleSelections, favoriteBooksNote) are unchanged.

New:
- `VibeContext` — `{ theme: VibeTheme | null, dragIntensity: number }` plus setters.
  Provided in `layout.tsx`, seeded server-side from the session preference, consumed by
  `VibeBackground`, written by `SwipeDeck` (per top card + drag), `Quiz` (per mood
  selection), and the landing mood picker.
- Landing: `selectedMood` local state.
- Quiz: account step fields; auth submission before `submitQuiz`.

## Design Tokens

All already committed in `web/src/app/globals.css` — use the CSS variables, not literals.

| Token | Value |
| --- | --- |
| `--background` | `#faf6f0` |
| `--foreground` | `#241b2f` |
| `--card` | `#ffffff` |
| `--card-border` | `#e7ded1` |
| `--accent` | `#5b2a86` |
| `--muted` | `#6b6270` |
| `--tag-genre` / fg | `#efe6da` / `#4a3f33` |
| `--tag-trope` / fg | `#f3e6f6` / `#5b2a86` |
| `--tag-mood` / fg | `#e6eef3` / `#234a63` |

Body copy used in the mock beyond the tokens: `#4a4353` (a slightly lifted foreground for
long-form paragraphs). Add as `--body-muted` if you want it tokenized.

Vibe families (unchanged, from `lib/theme.ts`):

| Family | base / light / deep |
| --- | --- |
| cozy | `#e8b568` / `#f4d9a0` / `#c97a3d` |
| dark | `#5e0b15` / `#7a1420` / `#2b0a10` |
| whimsical | `#c9a7eb` / `#e6d4f5` / `#a97fd4` |
| melancholy | `#5c6b73` / `#7d8ca3` / `#46525a` |

Type: Fraunces for headings and titles, Geist for body and UI, Geist Mono unused here.
Both already loaded in `layout.tsx`. Note `DECISIONS.md` D13 marks Fraunces as a
placeholder pending branding — these mocks keep it.

Radii: 999px pills, 20px hero cards, 18px book cards and panels, 16px prompts,
14px shelf cards, 12px inputs, 6px stamps, 4px genre chip.

Shadows: `0 4px 16px rgba(36,27,47,.07)` shelf cards · `0 8px 30px rgba(36,27,47,.12)`
deck cards · `0 10px 40px rgba(36,27,47,.08)` hero panel ·
`0 6px 20px rgba(91,42,134,.22)` primary CTA · `0 10px 34px rgba(91,42,134,.16)` premium card.

## Assets

- **Book covers** — the mock uses typographic gradient placeholders. Production should
  use the committed `web/public/covers/*.svg`.
- **Icons** — none used. The pass/like buttons are the `✕` and `♥` characters, matching
  the current `SwipeDeck` implementation. Swap for a real icon set if you adopt one.
- **Fonts** — Fraunces and Geist via `next/font/google`, already wired.
- **Book data** — the eight titles in the mock are invented, in the spirit of the
  synthetic catalog in `prisma/seed-data/catalog.json`. Not for production.

## Files

- `BookUp Mockups.dc.html` — the full interactive prototype. Open it in a browser. The
  top bar (screen tabs, Desktop/Mobile toggle) is prototype scaffolding, not product UI.

Source files this design modifies:

| Area | File |
| --- | --- |
| Gradient fix, families | `web/src/lib/theme.ts` |
| Full-bleed glow, cross-fade | `web/src/components/VibeBackground.tsx` |
| Vibe context provider | `web/src/app/layout.tsx` |
| Drift keyframes | `web/src/app/globals.css` |
| Landing page | `web/src/app/page.tsx` (new route or signed-out branch) |
| Onboarding + account step | `web/src/components/Quiz.tsx` |
| Deck motion, rail, cap prompt | `web/src/components/SwipeDeck.tsx` |
| Card treatment | `web/src/components/BookCard.tsx` |
| Grouped shelf | `web/src/app/tbr/page.tsx` |
| Match weights (read only) | `web/src/lib/matching.ts` |
| Daily cap (read only) | `web/src/lib/constants.ts` |

## Open questions for product

1. Premium feature list and $4/mo price are placeholders — confirm before building.
2. Account is now required; "02 — no account" on the landing strip contradicts that.
3. Do anonymous sessions still exist, or does sign-up gate the deck entirely?
4. Should the vibe theme override (`ThemeSwitcher`) survive now that the glow is
   per-card? It currently pins one family for the session; the two will fight.
