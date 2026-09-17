import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSiteOrigin } from "@/lib/site";

// D80 (Phase 4 quick win): dynamic per-book share image, Next's built-in
// file convention — this file alone wires up the og:image/twitter:image
// meta tags for everything under this route segment, no manual metadata
// needed for the image itself (page.tsx's generateMetadata below still
// handles title/description).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Static hex values, not the app's CSS custom properties — next/og renders
// via Satori in an isolated context that never sees globals.css, so this
// intentionally hardcodes the "cozy" (default) theme's palette (theme.ts)
// rather than trying to thread the runtime theme through image generation.
const BACKGROUND = "#f5e6c8";
const ACCENT = "#4c2273";
const INK = "#241b2f";

export default async function ShareOgImage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { title: true, author: true, coverUrl: true, hookLine: true },
  });

  // D83: the synthetic catalog's placeholder covers are root-relative
  // paths (e.g. "/covers/missing.svg", generate-catalog.ts) — real-catalog
  // covers are always absolute (https://covers.openlibrary.org/...). next/og
  // renders via Satori in an isolated context with no request origin to
  // resolve a relative URL against, so a relative src silently fails to
  // load. Any TBR'd book can reach this route (ShareButton doesn't
  // distinguish catalog source), so this has to handle both.
  const coverUrl = book?.coverUrl?.startsWith("/")
    ? `${getSiteOrigin(await headers())}${book.coverUrl}`
    : book?.coverUrl;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          padding: "64px",
          backgroundColor: BACKGROUND,
          fontFamily: "sans-serif",
        }}
      >
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- next/og's renderer requires a plain <img>, not next/image
          <img
            src={coverUrl}
            alt=""
            width={320}
            height={480}
            style={{ borderRadius: 16, objectFit: "cover", boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 56, maxWidth: 680 }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: ACCENT, letterSpacing: 2, textTransform: "uppercase" }}>
            I just matched with
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, color: INK, marginTop: 16, lineHeight: 1.1 }}>
            {book?.title ?? "a great book"}
          </div>
          {book?.author && (
            <div style={{ fontSize: 32, color: INK, marginTop: 12, opacity: 0.75 }}>{book.author}</div>
          )}
          <div style={{ fontSize: 26, color: ACCENT, marginTop: 40, fontWeight: 600 }}>
            Find your next match at BookUp
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
