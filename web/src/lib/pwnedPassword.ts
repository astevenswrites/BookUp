import { createHash } from "node:crypto";

// D78: Supabase's built-in "leaked password protection" (checks new
// passwords against HaveIBeenPwned's breach corpus at signup) is gated
// behind their Pro plan. The check itself doesn't need Supabase at all —
// HIBP's Pwned Passwords API is free and public, and uses k-anonymity
// specifically so this is safe to call with a real user's password: only
// the first 5 hex characters of its SHA-1 hash are ever sent, never the
// password itself or the full hash. See https://haveibeenpwned.com/API/v3#PwnedPasswords
//
// Fails OPEN (returns false — "not known to be pwned") on any network/API
// error. This is a defense-in-depth nice-to-have, not the account's only
// protection (Supabase Auth still enforces its own password rules) — a
// transient HIBP outage should never be able to block real signups.
export async function isPasswordPwned(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "Add-Padding": "true", // HIBP-recommended: pads the response so its size can't be used to guess the real count
        "User-Agent": "BookUp-SignupCheck/1.0",
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;

    const body = await res.text();
    return body.split("\n").some((line) => line.split(":")[0]?.trim() === suffix);
  } catch {
    return false;
  }
}
