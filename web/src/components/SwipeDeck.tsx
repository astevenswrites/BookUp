"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, useTransition, type Ref } from "react";
import Link from "next/link";
import { motion, useMotionValue, useTransform } from "motion/react";
import { BookCard } from "@/components/BookCard";
import { SwipeCommitVeil, pickVeilVariant } from "@/components/SwipeCommitVeil";
import { TbrBookshelf } from "@/components/TbrBookshelf";
import { MatchReasonsRail } from "@/components/MatchReasonsRail";
import { MatchReasonsMobile } from "@/components/MatchReasonsMobile";
import { SignUpWall } from "@/components/SignUpWall";
import { swipeBook, getMoreCards, undoLastSwipe } from "@/app/actions";
import type { BookWithTags } from "@/lib/books";
import { DAILY_SWIPE_CAP } from "@/lib/constants";
import { getMatchReasons } from "@/lib/matchReasons";
import type { DisplayMode } from "@/generated/prisma/enums";

// D54: drag is now the ONLY control — D26's tap-button fallback is gone,
// per the user's own suggestion (raised during the D52 pause): no Pass/Like
// buttons, light visual cues on the card itself instead. To not lose D26's
// original "works on any input device" rationale entirely, ArrowLeft/
// ArrowRight are a (non-visual) keyboard equivalent — see the keydown
// effect below — so this isn't a strictly pointer-only interaction.
// D52 (README-v2 §2, "card physics") raised both thresholds above the
// design spec's own 110/500 — both directions should take a deliberate
// motion, not a hair-trigger. Left (pass/discard) deliberately takes MORE
// force than right: a discard is the harder-to-undo-feeling of the two
// (see the undo affordance below), so it shouldn't happen on an accidental
// half-drag the way a right-swipe reasonably can.
const RIGHT_OFFSET_THRESHOLD = 130;
const LEFT_OFFSET_THRESHOLD = 175;
// Motion's `info.velocity.x` is px/s, a different unit than the design
// spec's raw per-pointer-event delta — these are values picked and
// verified live to produce a deliberate "fast flick" feel, not a literal
// port of the spec's own number.
const RIGHT_VELOCITY_THRESHOLD = 600;
const LEFT_VELOCITY_THRESHOLD = 850;
const LOW_DECK_REFILL_AT = 3;
// D53: purely decorative "there's more behind this" cue — thin, content-free
// slivers peeking out below the top card, not full duplicate cards (see
// StackEdges below for why that's the safer way to show depth).
const MAX_STACK_EDGES = 5;
const STACK_EDGE_HEIGHT = 12;
const STACK_EDGE_GAP = 5;
const EXIT_DISTANCE = 760;
// Fire the actual swipe (removing the card from state) once the fly-off
// animation is this close to finished, not when it fully completes — by
// then the card has long since passed the visible edge of a ~384px-wide
// column, so there's no visible pop, just a snappier handoff to the next
// card underneath.
const EXIT_FIRE_EARLY_AT = 150;

export function SwipeDeck({
  initialDeck,
  remainingToday,
  displayMode = "cover_first",
  tagWeights: initialTagWeights,
  collaborativeBoosts: initialCollaborativeBoosts,
  currentMoodTagId,
  isAnonymous = false,
  initialTbrCount = 0,
}: {
  initialDeck: BookWithTags[];
  remainingToday: number;
  displayMode?: DisplayMode;
  tagWeights: Record<string, number>;
  collaborativeBoosts: Record<string, number>;
  currentMoodTagId: string | null;
  isAnonymous?: boolean;
  initialTbrCount?: number;
}) {
  const [deck, setDeck] = useState(initialDeck);
  const [remaining, setRemaining] = useState(remainingToday);
  const [seenIds, setSeenIds] = useState<string[]>(initialDeck.map((b) => b.id));
  const [isFetchingMore, startFetchMore] = useTransition();
  const [tbrCount, setTbrCount] = useState(initialTbrCount);
  const [, startTransition] = useTransition();

  // D45/D46: refreshed after every refill (see commitSwipe) so the "why
  // this one" rail reflects the reader's latest swipes within the same
  // session, not just what was known at page load.
  const [tagWeights, setTagWeights] = useState(initialTagWeights);
  const [collaborativeBoosts, setCollaborativeBoosts] = useState(initialCollaborativeBoosts);

  // D52: a safety net for the raised swipe-force thresholds — only ever
  // the single most recent swipe, not a history. Auto-clears after a few
  // seconds so it doesn't linger as a permanent "undo" affordance.
  const [lastSwiped, setLastSwiped] = useState<{
    book: BookWithTags;
    direction: "left" | "right";
  } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const topCard = deck[0];

  // D45: dwell time + "opened details before deciding" for the card
  // currently on top — reset whenever a new card takes the top slot. The
  // real timestamp is only ever set inside the effect (not at render time,
  // per react-hooks/purity) — the 0 initializer is never read since the
  // effect runs before any swipe is possible.
  const cardShownAt = useRef(0);
  const viewedDetailsForTop = useRef(false);
  useEffect(() => {
    cardShownAt.current = Date.now();
    viewedDetailsForTop.current = false;
  }, [topCard?.id]);

  // D54: keyboard equivalent for the now-buttonless swipe — `topCardRef`
  // always points at whichever SwipeCard instance is currently mounted, so
  // there's no stale-direction risk from a previous card (see SwipeCard's
  // own `commit` handle for why this is a ref call, not lifted state).
  const topCardRef = useRef<SwipeCardHandle>(null);
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.repeat || !topCard) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
        return;
      }
      if (e.key === "ArrowLeft") topCardRef.current?.commit("left");
      else if (e.key === "ArrowRight") topCardRef.current?.commit("right");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [topCard]);

  const tagWeightMap = useMemo(() => new Map(Object.entries(tagWeights)), [tagWeights]);
  const matchReasons = useMemo(
    () =>
      topCard
        ? getMatchReasons(topCard, tagWeightMap, currentMoodTagId, collaborativeBoosts[topCard.id] ?? 0)
        : [],
    [topCard, tagWeightMap, currentMoodTagId, collaborativeBoosts]
  );
  const topCardMoodLabels = useMemo(
    () =>
      topCard
        ? topCard.tags.filter(({ tag }) => tag.category === "mood").map(({ tag }) => tag.label)
        : [],
    [topCard]
  );

  function commitSwipe(book: BookWithTags, direction: "left" | "right") {
    // commitSwipe only ever runs from click/drag-end event handlers below,
    // never during render.
    // eslint-disable-next-line react-hooks/purity
    const dwellMs = Date.now() - cardShownAt.current;
    const meta = { dwellMs, viewedDetails: viewedDetailsForTop.current };

    setDeck((prev) => prev.slice(1));
    setRemaining((prev) => prev - 1);
    if (direction === "right") setTbrCount((n) => n + 1);

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setLastSwiped({ book, direction });
    undoTimeoutRef.current = setTimeout(() => setLastSwiped(null), 6000);

    startTransition(async () => {
      await swipeBook(book.id, direction, meta);
    });

    if (deck.length - 1 <= LOW_DECK_REFILL_AT) {
      startFetchMore(async () => {
        const more = await getMoreCards(seenIds);
        setSeenIds((prev) => [...prev, ...more.books.map((b) => b.id)]);
        setDeck((prev) => [...prev, ...more.books]);
        setTagWeights((prev) => ({ ...prev, ...more.tagWeights }));
        setCollaborativeBoosts((prev) => ({ ...prev, ...more.collaborativeBoosts }));
      });
    }
  }

  function handleUndo() {
    if (!lastSwiped) return;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    const { book, direction } = lastSwiped;
    setLastSwiped(null);
    setDeck((prev) => [book, ...prev]);
    setRemaining((prev) => prev + 1);
    if (direction === "right") setTbrCount((n) => Math.max(0, n - 1));

    startTransition(async () => {
      await undoLastSwipe(book.id);
    });
  }

  if (remaining <= 0) {
    if (isAnonymous) return <SignUpWall matchCount={tbrCount} />;

    return (
      <div className="mx-auto flex w-full min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="font-serif text-2xl text-on-vibe">
          That&apos;s today&apos;s matches!
        </h2>
        <p className="mt-2 text-sm text-on-vibe-muted">
          You added {tbrCount > 0 ? tbrCount : "some"} book{tbrCount === 1 ? "" : "s"} to your
          shelf. Come back tomorrow for {DAILY_SWIPE_CAP} more.
        </p>
        <Link
          href="/tbr"
          className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground"
        >
          View your shelf
        </Link>
      </div>
    );
  }

  if (!topCard) {
    return (
      <div className="mx-auto flex w-full min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="font-serif text-2xl text-on-vibe">
          {isFetchingMore ? "Finding more books..." : "You've seen everything for now."}
        </h2>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-6 px-4 py-8 lg:flex-row lg:items-start">
      <div className="flex w-full min-h-[70vh] max-w-sm flex-col items-center justify-center">
        <p className="mb-3 text-xs text-on-vibe-muted">
          {isAnonymous ? `${remaining} preview swipes left` : `${remaining} swipes left today`}
        </p>
        <div className="relative w-full">
          <StackEdges count={Math.min(MAX_STACK_EDGES, deck.length - 1)} />
          <SwipeCard
            ref={topCardRef}
            key={topCard.id}
            book={topCard}
            displayMode={displayMode}
            onSwipe={(direction) => commitSwipe(topCard, direction)}
            onDetailsOpen={() => {
              viewedDetailsForTop.current = true;
            }}
          />
        </div>

        <div className="mt-6 flex flex-col items-center gap-4">
          <p className="text-xs text-on-vibe-muted">
            <span aria-hidden>←</span> drag to pass · drag to like <span aria-hidden>→</span>
          </p>
          <TbrBookshelf count={tbrCount} />
        </div>

        {lastSwiped && (
          <button
            type="button"
            onClick={handleUndo}
            className="mt-4 flex items-center gap-1.5 rounded-full border border-card-border bg-card/90 px-3.5 py-1.5 text-xs font-medium text-on-vibe-muted shadow-sm backdrop-blur-sm hover:border-accent hover:text-on-vibe-accent"
          >
            <span aria-hidden>↺</span> Undo {lastSwiped.direction === "right" ? "like" : "pass"}
          </button>
        )}
      </div>

      <MatchReasonsRail reasons={matchReasons} moodLabels={topCardMoodLabels} />
      <MatchReasonsMobile reasons={matchReasons} moodLabels={topCardMoodLabels} />
    </div>
  );
}

// D53: replaces the old "render the next 2 real cards behind the top one,
// scaled/offset, capped + clipped" stack visual (D52). That approach could
// only ever show 1-2 layers before the cost (full BookCard + cover image
// per layer) and risk (clipped background content bleeding past the card
// edge into the button row — the exact bug D52 fixed) got out of hand.
// These are plain, content-free, pointer-events-none slivers — there's
// nothing in them to bleed or intercept a click, so showing 5 is free.
function StackEdges({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const depth = i + 1;
        return (
          <div
            key={depth}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 rounded-b-2xl border border-card-border bg-card"
            style={{
              bottom: -(depth * STACK_EDGE_GAP),
              height: STACK_EDGE_HEIGHT,
              zIndex: MAX_STACK_EDGES - depth,
              opacity: 1 - depth * 0.15,
            }}
          />
        );
      })}
    </>
  );
}

type SwipeCardHandle = { commit: (direction: "left" | "right") => void };

function SwipeCard({
  book,
  displayMode,
  onSwipe,
  onDetailsOpen,
  ref,
}: {
  book: BookWithTags;
  displayMode: DisplayMode;
  onSwipe: (direction: "left" | "right") => void;
  onDetailsOpen?: () => void;
  ref?: Ref<SwipeCardHandle>;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);

  // D52: drag-distance-driven intensity per direction, each 0 unless
  // actively dragging that way — feeds the commit veil below. Scaled to
  // each direction's own (asymmetric) commit threshold, so full intensity
  // lines up with "this is about to commit" rather than the fixed ramp the
  // design spec used before thresholds became asymmetric.
  const rightProgress = useTransform(x, (v) => Math.min(1, Math.max(0, v / RIGHT_OFFSET_THRESHOLD)));
  const leftProgress = useTransform(x, (v) => Math.min(1, Math.max(0, -v / LEFT_OFFSET_THRESHOLD)));

  // A random commit-animation flavor per card (not per swipe) — see
  // SwipeCommitVeil — so the deck doesn't play the exact same "you liked
  // this" animation on every single card. Picked once, lazily, so it's
  // stable for this card's whole lifetime.
  const rightVariant = useMemo(() => pickVeilVariant(book.id, "right"), [book.id]);
  const leftVariant = useMemo(() => pickVeilVariant(book.id, "left"), [book.id]);

  // D52 (README-v2 §2): 3D lift while dragging — the card tilts toward
  // wherever the pointer is on it, like it's being physically lifted off
  // the stack, and a cover sheen tracks the same point (see BookCard).
  const rotateXMv = useMotionValue(0);
  const rotateYMv = useMotionValue(0);
  const sheenX = useMotionValue(50);
  const sheenY = useMotionValue(30);
  const cardRef = useRef<HTMLDivElement>(null);

  function updateTilt(pointX: number, pointY: number) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = Math.min(1, Math.max(0, (pointX - rect.left) / rect.width));
    const py = Math.min(1, Math.max(0, (pointY - rect.top) / rect.height));
    rotateYMv.set((px - 0.5) * 9);
    rotateXMv.set((py - 0.5) * -7);
    sheenX.set(28 + px * 52);
    sheenY.set(18 + py * 44);
  }

  function resetTilt() {
    rotateXMv.set(0);
    rotateYMv.set(0);
  }

  // D52: which direction (if any) has committed — once set, drag is
  // disabled and `animate` takes the card the rest of the way off-screen
  // instead of it just vanishing from state with no exit motion at all
  // (the previous behavior).
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const hasFiredSwipeRef = useRef(false);

  // D54: the keyboard equivalent for drag-only swiping calls this directly
  // (not via a lifted prop) — a fresh SwipeCard instance is mounted per
  // card via `key={book.id}`, so `exitDirection` here always starts `null`
  // for whatever card is actually on top; there's no stale-direction value
  // to inherit from whatever the previous card last committed.
  useImperativeHandle(
    ref,
    () => ({
      commit: (direction) => setExitDirection((prev) => prev ?? direction),
    }),
    []
  );

  useEffect(() => {
    if (!exitDirection) return;
    hasFiredSwipeRef.current = false;
    const target = exitDirection === "right" ? EXIT_DISTANCE : -EXIT_DISTANCE;
    const unsubscribe = x.on("change", (latest) => {
      if (!hasFiredSwipeRef.current && Math.abs(target - latest) < EXIT_FIRE_EARLY_AT) {
        hasFiredSwipeRef.current = true;
        onSwipe(exitDirection);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- x and onSwipe are stable for this card's lifetime
  }, [exitDirection]);

  return (
    <motion.div
      ref={cardRef}
      // Normal document flow (position: relative) so this establishes its
      // own natural height — the whole card, including an expanded "More
      // details" section, is always fully visible with no internal
      // scrollbar; the page scrolls if it needs to, not a clipped pane.
      // (D53: the deck's "there's more behind this" cue is now the
      // content-free StackEdges slivers rendered alongside this card, not
      // additional real cards — see StackEdges above for why.)
      // zIndex must beat StackEdges' own (0 to MAX_STACK_EDGES-1) explicitly
      // — a positioned element with z-index:auto (the default, if this were
      // left unset) still paints BEHIND any sibling that has a real,
      // non-auto z-index, even a small positive one. Without this, the top
      // card rendered visually behind its own stack-edge slivers.
      className="relative w-full rounded-2xl"
      style={{
        x,
        rotate,
        rotateX: rotateXMv,
        rotateY: rotateYMv,
        transformPerspective: 1400,
        transformOrigin: "50% 88%",
        zIndex: MAX_STACK_EDGES + 1,
      }}
      drag={!exitDirection && "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      // Low-bounce on purpose (README-v2 §2) — a book card reads as light;
      // too much spring overshoot reads as rubber, not paper.
      dragTransition={{ bounceStiffness: 420, bounceDamping: 34 }}
      onDrag={(_, info) => updateTilt(info.point.x, info.point.y)}
      onDragEnd={(_, info) => {
        const rightFlick = info.velocity.x > RIGHT_VELOCITY_THRESHOLD;
        const leftFlick = info.velocity.x < -LEFT_VELOCITY_THRESHOLD;
        if (info.offset.x > RIGHT_OFFSET_THRESHOLD || rightFlick) {
          setExitDirection("right");
        } else if (info.offset.x < -LEFT_OFFSET_THRESHOLD || leftFlick) {
          setExitDirection("left");
        } else {
          resetTilt();
        }
      }}
      animate={
        exitDirection
          ? { x: exitDirection === "right" ? EXIT_DISTANCE : -EXIT_DISTANCE }
          : { x: 0, rotateX: 0, rotateY: 0 }
      }
      transition={exitDirection ? { duration: 0.32, ease: "easeOut" } : undefined}
    >
      <SwipeCommitVeil direction="right" variant={rightVariant} progress={rightProgress} />
      <SwipeCommitVeil direction="left" variant={leftVariant} progress={leftProgress} />
      <BookCard
        book={book}
        displayMode={displayMode}
        onDetailsOpen={onDetailsOpen}
        sheen={{ x: sheenX, y: sheenY }}
      />
    </motion.div>
  );
}
