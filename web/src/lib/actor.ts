import { getSessionId, getOrCreateSessionId } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// D34: every mutation/query is keyed on whichever identity is present — a
// logged-in Supabase user, or (pre-Phase-2, and for anyone who hasn't signed
// up) the anonymous cookie session from D3/D22. Never both. `kind` is an
// explicit discriminant — TS can't reliably narrow a union on truthiness of
// a `string | null` field alone.
export type Actor = { kind: "user"; userId: string } | { kind: "session"; sessionId: string };
export type MaybeActor = Actor | { kind: "none" };

// Read-only — safe from Server Components. Returns { kind: "none" } if
// there's no logged-in user and no prior anonymous swipe to look up.
export async function getActor(): Promise<MaybeActor> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { kind: "user", userId: user.id };

  const sessionId = await getSessionId();
  return sessionId ? { kind: "session", sessionId } : { kind: "none" };
}

// Mutating — only from Server Actions/Route Handlers. Creates the anonymous
// cookie session on first touch if there's no logged-in user.
export async function getOrCreateActor(): Promise<Actor> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { kind: "user", userId: user.id };

  const sessionId = await getOrCreateSessionId();
  return { kind: "session", sessionId };
}

export function actorWhere(actor: Actor): { userId: string } | { sessionId: string } {
  return actor.kind === "user" ? { userId: actor.userId } : { sessionId: actor.sessionId };
}

export function hasIdentity(actor: MaybeActor): actor is Actor {
  return actor.kind !== "none";
}
