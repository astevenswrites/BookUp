"use client";

import { useState } from "react";
import { MatchReasonsContent } from "@/components/MatchReasonsRail";
import type { MatchReason } from "@/lib/matchReasons";

// Phone/tablet equivalent of the desktop MatchReasonsRail — that's a
// permanent sticky sidebar, but there's no room for a second column on a
// narrow screen, and stacking the same content into the page itself would
// make an already-tall expanded card (see the swipe-card clipping fix)
// even longer. Instead: a small floating button that opens the same
// content in a bottom sheet, dismissed on demand instead of always taking
// up scroll space.
export function MatchReasonsMobile({
  reasons,
  moodLabels,
}: {
  reasons: MatchReason[];
  moodLabels: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Why this one"
        // bottom-20 (not bottom-6) so this clears the fixed ThemeSwitcher
        // pill ("🎨 Auto" etc.) sitting at bottom-4 right-4 in the same corner.
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-accent bg-card text-xl font-serif text-accent shadow-lg"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Why this one">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-card p-5 pb-8 shadow-2xl">
            <div className="mb-3.5 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                Why this one
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-accent"
              >
                Done
              </button>
            </div>
            <MatchReasonsContent reasons={reasons} moodLabels={moodLabels} />
          </div>
        </div>
      )}
    </div>
  );
}
