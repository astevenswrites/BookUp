import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionId } from "@/lib/session";
import { mergeAnonymousSessionIntoUser } from "@/lib/mergeAnonymousSession";

const SESSION_COOKIE = "bd_session";

// Call once right after Supabase confirms a session exists (password
// sign-in/up, or the OAuth callback). `authUser.id` becomes our `User.id`
// directly — see DECISIONS.md D34 — so the two never drift.
export async function completeSignIn(authUser: { id: string; email?: string }): Promise<void> {
  await prisma.user.upsert({
    where: { id: authUser.id },
    update: { email: authUser.email ?? undefined },
    create: { id: authUser.id, email: authUser.email ?? `${authUser.id}@unknown.invalid` },
  });

  const sessionId = await getSessionId();
  if (sessionId) {
    await mergeAnonymousSessionIntoUser(authUser.id, sessionId);
    const store = await cookies();
    store.delete(SESSION_COOKIE);
  }
}
