"use client";

import { motion, useTransform, type MotionValue } from "motion/react";

// D52: "swiping should feel like something is actually happening" — the
// original implementation just removed the card from state with no exit
// animation at all, and the only feedback was a small corner badge. Three
// distinct full-card treatments per direction, picked once per card (see
// SwipeDeck's per-card random pick) so the deck doesn't show the exact same
// commit animation every single time. `progress` is 0-1, driven by drag
// distance in the direction this veil belongs to (0 while dragging/settled
// the other way, or not dragging at all).

const RIGHT_COLOR = "#2f6b3f";
const LEFT_COLOR = "#a33a2a";

export const VEIL_VARIANT_COUNT = 3;

type VeilProps = {
  direction: "left" | "right";
  progress: MotionValue<number>;
};

// 0 — Wash: a full-card color wash with a centered label, scaling in.
// This is the design handoff's baseline (README-v2 §2 "commit veil").
function WashVeil({ direction, progress }: VeilProps) {
  const color = direction === "right" ? RIGHT_COLOR : LEFT_COLOR;
  const label = direction === "right" ? "To read" : "Pass";
  const scale = useTransform(progress, [0, 1], [0.86, 1]);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl"
      style={{ opacity: progress, background: color }}
    >
      <motion.span className="font-serif text-3xl text-white" style={{ scale }}>
        {label}
      </motion.span>
    </motion.div>
  );
}

// 1 — Stamp: a rotated, bordered stamp-style badge that pops in slightly
// oversized before settling, like a rubber stamp hitting paper.
function StampVeil({ direction, progress }: VeilProps) {
  const color = direction === "right" ? RIGHT_COLOR : LEFT_COLOR;
  const label = direction === "right" ? "TO READ" : "PASS";
  const rotate = direction === "right" ? -8 : 8;
  const scale = useTransform(progress, [0, 0.6, 1], [1.4, 0.92, 1]);
  const backdropOpacity = useTransform(progress, [0, 1], [0, 0.35]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl">
      <motion.div className="absolute inset-0 rounded-2xl bg-black" style={{ opacity: backdropOpacity }} />
      <motion.div
        className="rounded-lg border-4 px-6 py-2.5"
        style={{
          opacity: progress,
          scale,
          rotate,
          borderColor: color,
          color,
          background: "rgba(255,255,255,0.92)",
        }}
      >
        <span className="font-serif text-2xl font-bold tracking-wide">{label}</span>
      </motion.div>
    </div>
  );
}

// 2 — Glow: a soft radial glow blooming from center with a big icon
// (checkmark / cross) scaling and rotating in — more celebratory/decisive.
function GlowVeil({ direction, progress }: VeilProps) {
  const color = direction === "right" ? RIGHT_COLOR : LEFT_COLOR;
  const icon = direction === "right" ? "✓" : "✕";
  const scale = useTransform(progress, [0, 1], [0.5, 1]);
  const rotate = useTransform(progress, [0, 1], [direction === "right" ? -30 : 30, 0]);
  const glowOpacity = useTransform(progress, [0, 1], [0, 0.55]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-2xl">
      <motion.div
        className="absolute h-full w-full"
        style={{
          opacity: glowOpacity,
          background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
        }}
      />
      <motion.span
        className="text-7xl font-bold"
        style={{ opacity: progress, scale, rotate, color }}
      >
        {icon}
      </motion.span>
    </div>
  );
}

const VARIANTS = [WashVeil, StampVeil, GlowVeil];

// Deterministic, not Math.random() — SwipeCard is server-rendered for the
// initial HTML and then hydrated on the client; a truly random pick would
// produce a DIFFERENT variant in each environment (caught live: React's
// hydration-mismatch error, since the server and client markup disagreed).
// Hashing the book id (identical in both places) instead gives the same
// "looks random across the deck" variety without ever disagreeing with
// itself. `salt` lets the same book get independent left/right picks.
export function pickVeilVariant(bookId: string, salt: string): number {
  let hash = 0;
  const input = `${bookId}:${salt}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % VEIL_VARIANT_COUNT;
}

export function SwipeCommitVeil({
  direction,
  variant,
  progress,
}: {
  direction: "left" | "right";
  variant: number;
  progress: MotionValue<number>;
}) {
  const Veil = VARIANTS[variant] ?? WashVeil;
  return <Veil direction={direction} progress={progress} />;
}
