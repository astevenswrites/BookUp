"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion, useMotionValue, useTransform } from "motion/react";
import { BookCard } from "@/components/BookCard";
import { MatchReasonsRail } from "@/components/MatchReasonsRail";
import { MatchReasonsMobile } from "@/components/MatchReasonsMobile";
import { SignUpWall } from "@/components/SignUpWall";
import { swipeBook, getMoreCards } from "@/app/actions";
import type { BookWithTags } from "@/lib/books";
import { DAILY_SWIPE_CAP } from "@/lib/constants";
import { getMatchReasons } from "@/lib/matchReasons";
import type { DisplayMode } from "@/generated/prisma/enums";

// Buttons are the primary control; drag is progressive enhancement — D26.
const SWIPE_THRESHOLD = 120;
const LOW_DECK_REFILL_AT = 3;

export function SwipeDeck({
  initialDeck,
  remainingToday,
  displayMode = "cover_first",
  tagWeights: initialTagWeights,
  collaborativeBoosts: initialCollaborativeBoosts,
  currentMoodTagId,
  isAnonymous = false,
}: {
  initialDeck: BookWithTags[];
  remainingToday: number;
  displayMode?: DisplayMode;
  tagWeights: Record<string, number>;
  collaborativeBoosts: Record<string, number>;
  currentMoodTagId: string | null;
  isAnonymous?: boolean;
}) {
  const [deck, setDeck] = useState(initialDeck);
  const [remaining, setRemaining] = useState(remainingToday);
  const [seenIds, setSeenIds] = useState<string[]>(initialDeck.map((b) => b.id));
  const [isFetchingMore, startFetchMore] = useTransition();
  const [tbrCount, setTbrCount] = useState(0);
  const [, startTransition] = useTransition();

  // D45/D46: refreshed after every refill (see commitSwipe) so the "why
  // this one" rail reflects the reader's latest swipes within the same
  // session, not just what was known at page load.
  const [tagWeights, setTagWeights] = useState(initialTagWeights);
  const [collaborativeBoosts, setCollaborativeBoosts] = useState(initialCollaborativeBoosts);

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

  function commitSwipe(bookId: string, direction: "left" | "right") {
    // commitSwipe only ever runs from click/drag-end event handlers below,
    // never during render.
    // eslint-disable-next-line react-hooks/purity
    const dwellMs = Date.now() - cardShownAt.current;
    const meta = { dwellMs, viewedDetails: viewedDetailsForTop.current };

    setDeck((prev) => prev.slice(1));
    setRemaining((prev) => prev - 1);
    if (direction === "right") setTbrCount((n) => n + 1);

    startTransition(async () => {
      await swipeBook(bookId, direction, meta);
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
          {deck
            .slice(0, 3)
            .reverse()
            .map((book, i, arr) => {
              const isTop = i === arr.length - 1;
              return (
                <SwipeCard
                  key={book.id}
                  book={book}
                  isTop={isTop}
                  stackDepth={arr.length - 1 - i}
                  displayMode={displayMode}
                  onSwipe={(direction) => commitSwipe(book.id, direction)}
                  onDetailsOpen={isTop ? () => { viewedDetailsForTop.current = true; } : undefined}
                />
              );
            })}
        </div>

        <div className="mt-6 flex gap-4">
          <button
            type="button"
            onClick={() => commitSwipe(topCard.id, "left")}
            aria-label="Pass"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-card-border bg-card text-2xl text-foreground/60 shadow-sm hover:border-foreground/30"
          >
            ✕
          </button>
          <button
            type="button"
            onClick={() => commitSwipe(topCard.id, "right")}
            aria-label="Like"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-accent bg-accent text-2xl text-accent-foreground shadow-sm"
          >
            ♥
          </button>
        </div>
      </div>

      <MatchReasonsRail reasons={matchReasons} moodLabels={topCardMoodLabels} />
      <MatchReasonsMobile reasons={matchReasons} moodLabels={topCardMoodLabels} />
    </div>
  );
}

function SwipeCard({
  book,
  isTop,
  stackDepth,
  displayMode,
  onSwipe,
  onDetailsOpen,
}: {
  book: BookWithTags;
  isTop: boolean;
  stackDepth: number;
  displayMode: DisplayMode;
  onSwipe: (direction: "left" | "right") => void;
  onDetailsOpen?: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -20], [1, 0]);

  return (
    <motion.div
      // The top card sits in normal document flow (position: relative) so it
      // establishes its own natural height — the whole card, including an
      // expanded "More details" section, is always fully visible with no
      // internal scrollbar; the page scrolls if it needs to, not a clipped
      // pane. Only the two peek-behind stack cards are position: absolute,
      // purely for the layered-stack visual — they never need to affect
      // layout height since they're always smaller (scaled down) and mostly
      // hidden behind the top card anyway.
      className={
        isTop
          ? "relative w-full rounded-2xl"
          : "absolute inset-x-0 top-0 w-full rounded-2xl"
      }
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale: 1 - stackDepth * 0.04,
        top: isTop ? undefined : stackDepth * 8,
        zIndex: 10 - stackDepth,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_THRESHOLD) onSwipe("right");
        else if (info.offset.x < -SWIPE_THRESHOLD) onSwipe("left");
      }}
      animate={isTop ? { x: 0 } : undefined}
    >
      {isTop && (
        <>
          <motion.div
            style={{ opacity: likeOpacity }}
            className="pointer-events-none absolute right-4 top-4 z-10 rounded border-2 border-green-500 px-2 py-1 text-sm font-bold text-green-500"
          >
            TO READ
          </motion.div>
          <motion.div
            style={{ opacity: passOpacity }}
            className="pointer-events-none absolute left-4 top-4 z-10 rounded border-2 border-red-500 px-2 py-1 text-sm font-bold text-red-500"
          >
            PASS
          </motion.div>
        </>
      )}
      <BookCard book={book} displayMode={displayMode} onDetailsOpen={onDetailsOpen} />
    </motion.div>
  );
}
