"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion, useMotionValue, useTransform } from "motion/react";
import { BookCard } from "@/components/BookCard";
import { MatchReasonsRail } from "@/components/MatchReasonsRail";
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
  likedTagIds,
  currentMoodTagId,
}: {
  initialDeck: BookWithTags[];
  remainingToday: number;
  displayMode?: DisplayMode;
  likedTagIds: string[];
  currentMoodTagId: string | null;
}) {
  const [deck, setDeck] = useState(initialDeck);
  const [remaining, setRemaining] = useState(remainingToday);
  const [seenIds, setSeenIds] = useState<string[]>(initialDeck.map((b) => b.id));
  const [isFetchingMore, startFetchMore] = useTransition();
  const [tbrCount, setTbrCount] = useState(0);
  const [, startTransition] = useTransition();

  const topCard = deck[0];
  const likedTagIdSet = useMemo(() => new Set(likedTagIds), [likedTagIds]);
  const matchReasons = useMemo(
    () => (topCard ? getMatchReasons(topCard, likedTagIdSet, currentMoodTagId) : []),
    [topCard, likedTagIdSet, currentMoodTagId]
  );
  const topCardMoodLabels = useMemo(
    () =>
      topCard
        ? topCard.tags.filter(({ tag }) => tag.category === "mood").map(({ tag }) => tag.label)
        : [],
    [topCard]
  );

  function commitSwipe(bookId: string, direction: "left" | "right") {
    setDeck((prev) => prev.slice(1));
    setRemaining((prev) => prev - 1);
    if (direction === "right") setTbrCount((n) => n + 1);

    startTransition(async () => {
      await swipeBook(bookId, direction);
    });

    if (deck.length - 1 <= LOW_DECK_REFILL_AT) {
      startFetchMore(async () => {
        const more = await getMoreCards(seenIds);
        setSeenIds((prev) => [...prev, ...more.map((b) => b.id)]);
        setDeck((prev) => [...prev, ...more]);
      });
    }
  }

  if (remaining <= 0) {
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
        <p className="mb-3 text-xs text-on-vibe-muted">{remaining} swipes left today</p>
        <div className="relative w-full h-[600px]">
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
    </div>
  );
}

function SwipeCard({
  book,
  isTop,
  stackDepth,
  displayMode,
  onSwipe,
}: {
  book: BookWithTags;
  isTop: boolean;
  stackDepth: number;
  displayMode: DisplayMode;
  onSwipe: (direction: "left" | "right") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -20], [1, 0]);

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto rounded-2xl"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale: 1 - stackDepth * 0.04,
        top: stackDepth * 8,
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
      <BookCard book={book} displayMode={displayMode} />
    </motion.div>
  );
}
