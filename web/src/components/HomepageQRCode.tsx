import { headers } from "next/headers";
import QRCode from "qrcode";

// D43: a scannable link to the homepage itself, for sharing in person
// (demos, meetups). Points at whatever origin actually served this request
// (headers().get("host"), same pattern as signUpWithPassword's
// emailRedirectTo) rather than a hardcoded production URL, so it naturally
// points at localhost during dev and the real domain in production.
// Generated server-side as inline SVG (no client JS, no external image
// host) — dark-on-white regardless of the active vibe theme, since QR
// scanners need reliable contrast more than they need theme-matching.
export async function HomepageQRCode() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "book-up-hc6s.vercel.app";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const url = `${protocol}://${host}/`;

  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 160,
    color: { dark: "#241b2f", light: "#ffffff" },
  });

  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-center">
      <div
        className="rounded-2xl border border-card-border bg-white p-4 shadow-sm [&_svg]:block"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-xs text-on-vibe-muted">Scan to open BookUp on your phone</p>
    </div>
  );
}
