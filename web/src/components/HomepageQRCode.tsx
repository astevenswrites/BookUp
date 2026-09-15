import { headers } from "next/headers";
import QRCode from "qrcode";
import { getSiteOrigin } from "@/lib/site";

// D43: a scannable link to the homepage itself, for sharing in person
// (demos, meetups). D57: uses the same platform-provided-origin helper as
// signUpWithPassword's emailRedirectTo, rather than trusting the request's
// own Host header directly — points at the real production domain
// regardless of which deployment served the request, and at localhost in
// local dev. Generated server-side as inline SVG (no client JS, no external
// image host) — dark-on-white regardless of the active vibe theme, since QR
// scanners need reliable contrast more than they need theme-matching.
export async function HomepageQRCode() {
  const url = `${getSiteOrigin(await headers())}/`;

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
