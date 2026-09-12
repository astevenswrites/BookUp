import { cookies } from "next/headers";
import { VibeTheme } from "@/generated/prisma/enums";

const SESSION_COOKIE = "bd_session";
const DEMO_THEME_COOKIE = "bd_demo_theme";

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

// D41 correction: the landing page's "try it right here" mood demo used to
// be pure client-side React state, which reset on every navigation — a
// visitor picking "Dark" and clicking "Start the vibe check" immediately
// lost it. Can't just write this to Preference.themeOverride like the real
// post-quiz ThemeSwitcher does, because `hasIdentity`/`!!preference` is used
// elsewhere (page.tsx's landing-vs-product routing) as a proxy for "has
// taken the quiz" — creating a bare Preference row just from a color pick
// would wrongly skip a first-time visitor straight past the landing page.
// A separate plain cookie keeps the two concerns apart entirely.
export async function getDemoTheme(): Promise<VibeTheme | null> {
  const store = await cookies();
  const value = store.get(DEMO_THEME_COOKIE)?.value;
  return value && (Object.values(VibeTheme) as string[]).includes(value)
    ? (value as VibeTheme)
    : null;
}

export async function setDemoTheme(theme: VibeTheme): Promise<void> {
  const store = await cookies();
  store.set(DEMO_THEME_COOKIE, theme, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}
