import { cookies } from "next/headers";

const SESSION_COOKIE = "bd_session";

// Read-only — safe to call from Server Components. Returns null until the
// user's first mutation (quiz submit), which is when getOrCreateSessionId
// actually sets the cookie. See DECISIONS.md D22.
export async function getSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

// Only callable from a Server Action/Route Handler (sets a cookie).
export async function getOrCreateSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;
  if (existing) return existing;

  const id = crypto.randomUUID();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return id;
}
