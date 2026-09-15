"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

// D54 (drag-only redesign): with the Pass/Like buttons gone, a right swipe
// needed some other persistent, ambient payoff — a tiny shelf that visibly
// grows spine by spine as the reader's real TBR shelf grows, linking through
// to /tbr. `count` starts from the actual lifetime total (SwipeDeck's
// initialTbrCount, from the database), not 0, so this reads as real ongoing
// progress rather than a per-visit toy that resets the way the daily swipe
// counter does.
const MAX_VISIBLE_SPINES = 14;
const SPINE_HEIGHTS = [22, 30, 18, 26, 34, 20, 28, 24, 32, 19, 27, 23];
const SPINE_COLORS = ["bg-tag-mood", "bg-tag-trope", "bg-tag-genre", "bg-accent"];
const SHELF_HEIGHT = Math.max(...SPINE_HEIGHTS);

export function TbrBookshelf({ count }: { count: number }) {
  if (count <= 0) {
    return <p className="text-[11px] text-on-vibe-muted">Swipe right to start your shelf.</p>;
  }

  const visible = Math.min(count, MAX_VISIBLE_SPINES);
  const overflow = count - visible;

  return (
    <Link href="/tbr" className="group flex flex-col items-center gap-1.5" title="View your shelf">
      <div className="flex items-end gap-[3px]" style={{ height: SHELF_HEIGHT }}>
        <AnimatePresence initial={false}>
          {Array.from({ length: visible }, (_, i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              exit={{ scaleY: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              style={{ height: SPINE_HEIGHTS[i % SPINE_HEIGHTS.length], transformOrigin: "bottom" }}
              className={`w-[7px] rounded-t-sm ${SPINE_COLORS[i % SPINE_COLORS.length]}`}
            />
          ))}
        </AnimatePresence>
        {overflow > 0 && (
          <span className="ml-1 self-center text-[10px] font-medium text-on-vibe-muted">
            +{overflow}
          </span>
        )}
      </div>
      <div className="h-px w-full max-w-[160px] bg-card-border" />
      <span className="text-[11px] text-on-vibe-muted group-hover:text-on-vibe-accent">
        {count} book{count === 1 ? "" : "s"} on your shelf
      </span>
    </Link>
  );
}
