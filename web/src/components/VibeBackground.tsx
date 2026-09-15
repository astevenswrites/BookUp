"use client";

import { useEffect, useRef } from "react";
import { THEME_CONFIG, GROUND_TINT_OPACITY, getGroundTintColor } from "@/lib/theme";
import type { VibeTheme } from "@/generated/prisma/enums";

// D51 ("Reading Room" pass, README-v2 §1/§1b): four stacked layers, bottom
// to top — tint (opaque, carries color to the corners), far light, near
// light, dust — replacing the single radial-gradient vignette that could
// never truly reach a box's corners with color (the gradient *is* the
// color; corners are always farthest from center). See DECISIONS.md D51.
// Fixed, full-viewport, decorative only — never intercepts clicks, never
// announced to screen readers.
export function VibeBackground({ theme }: { theme: VibeTheme | null }) {
  const farRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);

  // Parallax: light layers drift opposite the pointer, gated behind
  // prefers-reduced-motion. Reads refs directly in the handler rather than
  // React state, so pointer moves never trigger a re-render.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function handlePointerMove(e: PointerEvent) {
      const px = e.clientX / window.innerWidth;
      const py = e.clientY / window.innerHeight;
      const farX = (px - 0.5) * 28;
      const farY = (py - 0.5) * 20;
      if (farRef.current) {
        farRef.current.style.setProperty("--parallax-x", `${-farX}px`);
        farRef.current.style.setProperty("--parallax-y", `${-farY}px`);
      }
      if (nearRef.current) {
        nearRef.current.style.setProperty("--parallax-x", `${farX}px`);
        nearRef.current.style.setProperty("--parallax-y", `${farY}px`);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  if (!theme) return null;

  const { colors, isDark } = THEME_CONFIG[theme];
  const tintColor = getGroundTintColor(theme);
  const lightColor = colors[1];
  const dustOpacity = isDark ? 0.3 : 0.45;

  return (
    <div aria-hidden className="vibe-ground pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="vibe-tint" style={{ background: tintColor, opacity: GROUND_TINT_OPACITY[theme] }} />
      <div
        ref={farRef}
        className="vibe-light vibe-light-far"
        style={{ background: `radial-gradient(circle, ${lightColor} 0%, transparent 70%)` }}
      />
      <div
        ref={nearRef}
        className="vibe-light vibe-light-near"
        style={{ background: `radial-gradient(circle, ${lightColor} 0%, transparent 70%)` }}
      />
      <div className="vibe-dust" style={{ opacity: dustOpacity }} />
    </div>
  );
}
