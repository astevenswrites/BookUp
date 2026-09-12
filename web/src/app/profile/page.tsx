import Link from "next/link";
import { getActor, actorWhere, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor, getPreferenceMoodLabels } from "@/lib/preferences";
import { getTagsByCategory } from "@/lib/tags";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Quiz } from "@/components/Quiz";

const STATUS_LABEL: Record<string, string> = {
  to_read: "To read",
  reading: "Reading",
  finished: "Finished",
  dnf: "Didn't finish",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const actor = await getActor();

  if (!hasIdentity(actor)) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="font-serif text-2xl text-on-vibe">No profile yet</h1>
        <p className="mt-2 text-sm text-on-vibe-muted">Take the quiz to get started.</p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground"
        >
          Take the quiz
        </Link>
      </div>
    );
  }

  const preference = await getPreferenceForActor(actor);
  if (!preference) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="font-serif text-2xl text-on-vibe">No profile yet</h1>
        <p className="mt-2 text-sm text-on-vibe-muted">Take the quiz to get started.</p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground"
        >
          Take the quiz
        </Link>
      </div>
    );
  }

  if (edit) {
    const tags = await getTagsByCategory();
    return (
      <Quiz
        tags={tags}
        redirectTo="/profile"
        initial={{
          favoriteBooksNote: preference.favoriteBooksNote,
          displayMode: preference.displayMode,
          heatLevelMax: preference.heatLevelMax,
          pacing: preference.pacing,
          readingFrequency: preference.readingFrequency,
          tagIds: preference.tags.map((t) => t.tagId),
        }}
      />
    );
  }

  const [swipeCounts, tbrCounts, supabase] = await Promise.all([
    prisma.swipe.groupBy({ by: ["direction"], where: actorWhere(actor), _count: true }),
    prisma.tBREntry.groupBy({ by: ["status"], where: actorWhere(actor), _count: true }),
    createServerSupabaseClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rightSwipes = swipeCounts.find((c) => c.direction === "right")?._count ?? 0;
  const leftSwipes = swipeCounts.find((c) => c.direction === "left")?._count ?? 0;
  const moods = getPreferenceMoodLabels(preference);

  return (
    <div className="flex-1 px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header>
          <h1 className="font-serif text-3xl text-on-vibe">Your profile</h1>
          {user?.email && <p className="mt-1 text-sm text-on-vibe-muted">{user.email}</p>}
          <Link href="/" className="mt-2 inline-block text-sm text-accent underline">
            Back to swiping
          </Link>
        </header>

        <section className="rounded-2xl border border-card-border bg-card p-5">
          <h2 className="font-serif text-lg text-foreground">Swipe stats</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Right swipes</dt>
              <dd className="text-xl font-medium text-foreground">{rightSwipes}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Left swipes</dt>
              <dd className="text-xl font-medium text-foreground">{leftSwipes}</dd>
            </div>
            {(["to_read", "reading", "finished", "dnf"] as const).map((status) => (
              <div key={status}>
                <dt className="text-xs text-muted">{STATUS_LABEL[status]}</dt>
                <dd className="text-xl font-medium text-foreground">
                  {tbrCounts.find((c) => c.status === status)?._count ?? 0}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-foreground">Your vibe</h2>
            <Link href="/profile?edit=1" className="text-sm text-accent underline">
              Edit
            </Link>
          </div>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between border-b border-card-border pb-2">
              <dt className="text-muted">Discovery style</dt>
              <dd className="text-foreground">
                {preference.displayMode === "vibe_first" ? "Vibes first" : "Covers first"}
              </dd>
            </div>
            <div className="flex justify-between border-b border-card-border pb-2">
              <dt className="text-muted">Heat level</dt>
              <dd className="text-foreground capitalize">{preference.heatLevelMax ?? "Any"}</dd>
            </div>
            <div className="flex justify-between border-b border-card-border pb-2">
              <dt className="text-muted">Pacing</dt>
              <dd className="text-foreground capitalize">
                {preference.pacing?.replace("_", " ") ?? "Any"}
              </dd>
            </div>
            <div className="flex justify-between border-b border-card-border pb-2">
              <dt className="text-muted">Reading frequency</dt>
              <dd className="text-foreground capitalize">{preference.readingFrequency ?? "—"}</dd>
            </div>
            {moods.length > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-muted">Moods</dt>
                <dd className="text-right text-foreground capitalize">{moods.join(", ")}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </div>
  );
}
