# BookUp — design handoff

Read in this order.

| File | What it is |
| --- | --- |
| `README-v2.md` | **Start here.** The current spec: ground + dual modes, card physics, editorial layer, sound. Has the build order. |
| `README.md` | v1. Still the source of truth for landing, onboarding, plans and shelf structure. v2 supersedes its §1 and §4. |
| `BookUp Mockups v2.dc.html` | The design reference. Open in a browser — drag the cards, switch feelings on the landing page, toggle sound in the header. |

Built against `astevenswrites/BookUp` @ `main`, `web/src`. The screen-to-source map is at
the end of `README.md`.

## First prompt for Claude Code

> Read `design_handoff_bookup_ui/README-v2.md`. It supersedes README.md §1 and §4.
> Implement sections 1 and 1b only — the opaque vibe ground and the dual light/dark mode
> token set, across `lib/theme.ts`, `components/VibeBackground.tsx`, `app/layout.tsx` and
> `app/globals.css`. Follow the existing patterns in `web/src`. Leave the other sections.

Then work down the build order in §"Build order", one section per session.

## Reference only — not for implementation

`variant-a-letterpress.dc.html`, `variant-c-marginalia.dc.html` — two directions not
taken. Kept because ideas from C (the editorial note, the typed verdict, the tally bars)
were folded into v2, and A's print treatment is still on the table if the brand moves.

## Two decisions blocking work

1. **Editorial notes (§3a)** — needs a human writing one honest line per book. Content
   pipeline, not a build task. Blocks that section.
2. **Premium tier** — the feature list and $4/mo in the mocks are invented placeholders.

## Known bug in the current repo

`buildVignetteGradient` in `web/src/lib/theme.ts` defaults to `farthest-corner` sizing, so
the gradient's 100% stop lands past the box edge and leaves hard seams on the horizontal
and vertical midlines. Two-line fix, detailed in `README.md` §1a. Worth doing regardless
of whether the rest of this lands.
