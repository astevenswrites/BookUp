"use client";

import { useState } from "react";

// D31: vibe-first mode hides the cover behind a tap-to-reveal overlay,
// reusing the same interaction pattern as content warnings (D10) rather
// than inventing new UI grammar for a single mode.
export function CoverReveal({ src, alt }: { src: string; alt: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- local generated SVG placeholder, see DECISIONS.md D6 */}
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-cover transition-all duration-300 ${
          revealed ? "" : "scale-110 blur-2xl"
        }`}
      />
      {!revealed && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-foreground/10 text-center text-sm font-medium text-white"
        >
          <span className="rounded-full bg-black/50 px-4 py-2">Reveal cover</span>
        </button>
      )}
    </div>
  );
}
