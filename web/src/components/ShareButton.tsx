"use client";

import { useState } from "react";

// D80: navigator.share (native share sheet) where supported — mobile
// Safari/Chrome, mainly — falling back to copy-link everywhere else
// (most desktop browsers don't implement the Web Share API at all).
export function ShareButton({ bookId, title }: { bookId: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/share/${bookId}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `I matched with ${title}!`, url });
      } catch {
        // User cancelled the share sheet — not an error worth surfacing.
      }
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="rounded-full border border-card-border bg-card px-2.5 py-1 text-xs font-medium text-muted hover:border-accent"
    >
      {copied ? "Link copied!" : "Share"}
    </button>
  );
}
