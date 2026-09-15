"use client";

import { useState } from "react";

// Tap-to-reveal detail view: full synopsis, page count, heat/pacing, and content
// warnings. Deliberately not shown on the card face — see DECISIONS.md D9/D10.
// D45: onOpen fires once on first expand — the "did they read the details
// before swiping" signal, bubbled up to SwipeDeck for the next swipeBook call.
export function BookDetails({
  blurb,
  pageCount,
  publishedYear,
  heatLevel,
  pacing,
  contentWarnings,
  onOpen,
}: {
  blurb: string;
  pageCount: number;
  publishedYear: number;
  heatLevel: string;
  pacing: string;
  contentWarnings: string[];
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 border-t border-card-border pt-3">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            if (!v) onOpen?.();
            return !v;
          });
        }}
        className="text-sm font-medium text-accent hover:underline"
        aria-expanded={open}
      >
        {open ? "Hide details" : "More details"}
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm text-foreground/80">
          <p>{blurb}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
            <dt>Pages</dt>
            <dd>{pageCount}</dd>
            <dt>Published</dt>
            <dd>{publishedYear}</dd>
            <dt>Heat level</dt>
            <dd className="capitalize">{heatLevel.replace("_", " ")}</dd>
            <dt>Pacing</dt>
            <dd className="capitalize">{pacing.replace("_", " ")}</dd>
          </dl>
          <div>
            <p className="text-xs font-medium text-muted mb-1">
              Content warnings
            </p>
            {contentWarnings.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {contentWarnings.map((cw) => (
                  <li
                    key={cw}
                    className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-foreground/70"
                  >
                    {cw}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">None listed</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
