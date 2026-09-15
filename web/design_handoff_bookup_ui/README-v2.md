# Handoff v2: BookUp — "Reading Room" character

Supersedes the browse/landing/onboarding/shelf direction in `README.md`. Everything in v1
still applies **except** where noted below — v1's §1 (vibe glow) is substantially revised
here, and §2–§5 gain the character layer.

Design reference: `BookUp Mockups v2.dc.html` (open in a browser). Prototype scaffolding
to ignore: the screen tabs in the top bar.

Three alternates were explored — `variant-a-letterpress.dc.html` (risograph/print),
`variant-b-reading-room.dc.html` (chosen), `variant-c-marginalia.dc.html` (bookseller's
desk). B won; A and C are included only as reference for ideas not taken.

---

## 1. Background must be full-bleed — supersedes v1 §1b

v1 tried to make the glow reach the page edges by sizing the gradient element. That can't
work: the color **is** the radial gradient, so corners always fall back to `--background`
no matter how the box is sized.

Correct structure — **four stacked layers** in `VibeBackground`, bottom to top:

1. **Tint** — `position: absolute; inset: 0`, a **flat opaque fill**. This is the page
   ground and it is what actually carries color to the corners. Per family:
   `dark 0.96`, `melancholy 0.92`, `cozy 0.86`, `whimsical 0.84`; `+drag × 0.04`, capped at 1.
   Dark-mode families fill with the family's **deep** color (`colors[2]`); light-mode
   families fill with the **light** color (`colors[1]`).
2. **Far light** — radial, `min(1500px, 175vw)` square, centered, `blur(30px)`,
   `opacity: 0.38 × strength`, `animation: bu-light 26s ease-in-out infinite reverse`.
3. **Near light** — radial, `min(900px, 120vw)`, `blur(12px)`, `opacity: 0.3 × strength`,
   `animation: bu-light 19s ease-in-out infinite`.
4. **Dust** — two `radial-gradient` dot patterns at `190px` and `127px`,
   `opacity: .3` dark / `.45` light,
   `animation: bu-dust 34s linear infinite`.

```css
@keyframes bu-light { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(20px,-24px,0) scale(1.06)} }
@keyframes bu-dust  { 0%{transform:translate3d(0,0,0)} 100%{transform:translate3d(-40px,-60px,0)} }
```

All four layers transition `background .8s ease, opacity .7s ease` so family changes
cross-fade. v1 §1a's `farthest-corner` fix still stands for the two light layers.
v1 §1c (four stacked families cross-fading) is **no longer needed** — with a flat tint
underneath, transitioning `background` on a single set of layers is smooth enough.

### Parallax

The page root tracks pointer position as normalized `px`/`py` (0–1). Light layers offset by
`(px - 0.5) × ±28px` and `(py - 0.5) × ±20px`, in opposite directions per layer, giving
depth. Gate behind `prefers-reduced-motion`.

The light pools are deliberately weak. With an opaque ground they only need to breathe —
at their earlier strength (0.6 / 0.46) they bleached the ground back toward cream and
undid the whole point.

### Drag response

Unchanged from v1 §1e in spirit, retuned: light opacity `+drag × 0.1`,
scale `1 + drag × 0.05`, tint opacity `+drag × 0.04`,
where `drag = min(abs(dragX) / 200, 1)`.

---

## 1b. Two modes, one selector — NEW, and the largest change in this pass

With an opaque ground, `dark` and `melancholy` are genuinely dark surfaces. Ink cannot stay
fixed: `#241b2f` body copy and the `#5b2a86` accent both fail against them. **Dark and
melancholy flip the whole interface to dark mode; cozy and whimsical stay light mode on a
saturated ground.**

Implement as a `data-mode="dark|light"` attribute on a wrapper the `VibeProvider` owns,
with the values below as CSS custom properties — **not** as per-component conditionals.
Every one of these transitions `.8s ease` alongside the ground, so switching feeling dims
or lifts the room as one move.

| Token | cozy / whimsical | dark | melancholy |
| --- | --- | --- | --- |
| `--ink-head` | `#241b2f` | `#fdf4f2` | `#f7fafb` |
| `--ink-body` | `#453e50` | `#f3dcd9` | `#e2ebef` |
| `--ink-faint` | `#645b6b` | `#dcb6b2` | `#bccbd3` |
| `--ink-accent` | `#4c2273` | `#f0b7c4` | `#cfd9ff` |
| `--rule` | `#241b2f` | `rgba(253,244,242,.72)` | `rgba(247,250,251,.72)` |
| `--track` | `rgba(36,27,47,.2)` | `rgba(253,244,242,.22)` | `rgba(247,250,251,.22)` |
| `--panel` | `rgba(255,255,255,.72)` | `rgba(28,8,12,.42)` | `rgba(18,28,34,.38)` |
| `--panel-edge` | `#ece4d8` | `rgba(253,244,242,.18)` | `rgba(247,250,251,.18)` |

Note `--ink-accent` is **not** brand purple in any mode: `#4c2273` is a deepened purple for
light grounds, and the dark modes swap to rose and periwinkle because purple disappears
into both. Brand purple survives as the primary button fill, where it sits on its own field.

Everything that reads the ground must follow the mode: headings, body, eyebrows, meta,
section rules, the quiz progress track and its fill, screen tabs, quiz chips, the sound
toggle, secondary buttons, the shelf's empty state and its group rules.

Two things stay fixed in both modes by design: **cards and their contents** (they are
cream surfaces sitting on the ground, not part of it), and the **landing mood pills**,
which are solid `#fffdf9` rather than translucent — a translucent pill over a dark ground
turned its label to mud.

Accessibility: this is also the answer to `prefers-contrast: more` — raise the ground's
opacity to 1 and drop the light pools to zero.

---

## 2. Card physics — revises v1 §4a

Threshold and commit behavior change. `SwipeDeck` should track **velocity**, not just offset.

- Per pointer move, `v = clientX - lastClientX`.
- On release: commit if `abs(dx) > 110` **or** `abs(v) > 12`. A fast flick commits even
  when short — this is the single biggest contributor to the cards feeling physical.
- Below threshold: spring back with `v += (0 - x) × 0.11 - v × 0.58` per frame. Low bounce
  on purpose; a book card reads as light, and overshoot reads as rubber.
- Commit: ease toward `±760px` at `0.17` per frame, fire the state change at `< 150px` remaining.

`motion/react`'s `useMotionValue` already gives you velocity via `useVelocity` — prefer that
over hand-rolling, and keep the drag loop off React state so pointer moves don't re-render.

### 3D lift

While dragging, the top card gets `rotateY((px - 0.5) × 9deg)` and
`rotateX((py - 0.5) × -7deg)` on a `perspective: 1400px` parent, plus
`transform-origin: 50% 88%`. Shadow grows with drag:
`0 {18 + drag×16}px {46 + drag×26}px rgba(36,27,47,{.16 + drag×.06})`.

### Cover sheen

A `radial-gradient` white highlight inside the cover, positioned at
`{28 + lean×52}% {18 + tilt×44}%`, `transition: background .18s linear`. It tracks the
pointer across the artwork like light on a dust jacket. Only on the top card.

### Commit veil

Replaces v1's stamp. A full-card gradient wash — `#2f6b3f` right / `#a33a2a` left — with the
word "To read" / "Pass" in Fraunces 28px white, scaling `0.86 → 1`. Opacity ramps
`(abs(dx) - 26) / 104`. Feedback builds during the drag rather than snapping at release.

---

## 3. Editorial layer — new

Three pieces, all reading from state you already have.

### 3a. Per-book editorial note

A one-sentence opinion on each book, on the card itself, in a `2px solid #5b2a86`
left-ruled block under the hook. Label "Our note" (Geist Mono 9px, `.16em`, uppercase),
body Fraunces italic 14px/1.5. Also appears on shelf cards.

Notes must be able to be unflattering — "The ending explains slightly too much" — or the
feature is worthless. **This needs a content pipeline**: an editorial field on the book
record, not generated copy. It is the strongest differentiator in the design and the most
operationally expensive; decide early whether you can staff it.

### 3b. "Reading you back"

A verdict line that types itself out character by character (16ms/char, blinking
`▍` caret in accent) and revises as the reader swipes. Escalating specificity:

| Condition | Line |
| --- | --- |
| < 3 swipes | "I don't know you yet. Give me three swipes." |
| 0 kept, n passed | "You've passed on {n} in a row. Either I've misread you completely or you're just browsing, which is allowed." |
| 1 kept | "One data point. You liked something {mood}, and I'm not building a theory on that." |
| all kept share one family | "Every book you've kept is {family}. You're not browsing, you're committing." |
| a tag repeats | "The word that keeps coming up is “{tag}”. You've kept {n} books with it." |
| otherwise | "Your taste is wider than most. Harder to please, more fun to guess at." |

Only re-type when the line actually changes. Sits in the browse rail and heads the shelf.
Clear the interval on unmount.

### 3c. "Your ledger"

Tally bars of moods and tropes across kept books, top 5 descending. 6px track
`#ece4d8`, fill `#5b2a86`, width `count / max`, `animation: bu-bar .5s cubic-bezier(.2,.9,.3,1)`
with `transform-origin: left`. Browse rail and shelf.

---

## 4. Sound — new, muted by default

Web Audio, synthesized, no asset files. A single header toggle, off on load; persist the
choice. Never autoplay — the first tone plays only on the user's own toggle-on.

| Event | Sound |
| --- | --- |
| Drag past 100px | Filtered noise burst through a 1500Hz lowpass, `sin` envelope — a page turn |
| Commit right | Two sines, 392Hz + 588Hz, 0.03s attack, 0.5s exponential decay |
| Commit left | Same, 196Hz + 294Hz |

Wrap in try/catch, resume a suspended `AudioContext` on the toggle, and honor
`prefers-reduced-motion` as a proxy for "reduce nonessential stimuli" if you want to be safe.

---

## 5. Everything else

Landing, onboarding (10 steps, account last), plans, and the grouped shelf are **unchanged
from v1 §2–§5** — same copy, same structure. Two deltas:

- Landing step 01 now reads "Answer ten quick questions" / "…Two minutes, then a free
  account to keep it." (v1's "no account" line was stale.)
- Hero body ends "…the whole room will start to look like it."
- Match % on the card is computed from onboarding overlap:
  `min(98, 74 + overlap×7 + depthBonus)`. **Placeholder** — replace with the real score
  from `lib/matching.ts`. Showing an invented number is worse than showing none.
- All fixed-width layout is now `repeat(auto-fit, minmax(…, 1fr))` and `clamp()` type, so
  the same markup serves desktop and mobile without a breakpoint fork.

## Tokens added beyond v1

| Token | Value | Use |
| --- | --- | --- |
| card surface | `#fffdf9` | Card ground, warmer than `--card` |
| card border | `#ece4d8` | Card edge on the tinted ground |
| ink muted | `#3c3547` | Editorial italic copy |
| ink faint | `#8b8291` | Eyebrows, meta |

Geist Mono joins Fraunces and Geist for eyebrow labels and counters — already available
via `next/font`.

## Build order

The sections are ordered by dependency; do them in this order, one per session, verifying
in the browser between each.

1. **§1 + §1b — ground and modes.** Everything else sits on this. Includes v1 §1a's
   `farthest-corner` gradient fix, which is a live bug in what's shipped today.
2. **§2 — card physics.** Self-contained in `SwipeDeck`.
3. **§5 — landing, onboarding, plans, shelf** (from v1 §2–§5, with this file's deltas).
4. **§3 — editorial layer.** Blocked on the content decision in open question 4.
5. **§4 — sound.** Last, and safe to cut.

## Open questions — carried forward, still unanswered

1. Premium feature list and $4/mo price.
2. Does sign-up gate the deck entirely, or do anonymous sessions survive?
3. `ThemeSwitcher` pins one family per session and will fight the per-card glow. Keep it
   as an accessibility override, or remove it?
4. Who writes the editorial notes (§3a)? Blocks that section entirely.
5. Fraunces is still marked provisional in `DECISIONS.md` D13. These mockups assume it
   ships; if branding lands on something else, the display type changes everywhere.
