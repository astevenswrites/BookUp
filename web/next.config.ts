import type { NextConfig } from "next";

// D57: baseline hardening headers. Deliberately NOT a strict script-src
// CSP (e.g. nonce-based) — Next's own hydration and Motion's runtime don't
// need 'unsafe-inline' for styles (both set styles via the DOM style API,
// which CSP doesn't govern at all, not by writing literal style="" HTML
// strings), but getting script-src right without breaking hydration needs
// wiring a per-request nonce through the proxy, which is a bigger, riskier
// change than this pass warrants. This is a real baseline (clickjacking,
// MIME-sniffing, no plugins/objects, no unrelated-origin framing) without
// that risk.
async function headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'none';" },
      ],
    },
  ];
}

const nextConfig: NextConfig = {
  headers,
};

export default nextConfig;
