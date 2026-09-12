import Link from "next/link";
import { TbrEntryCard } from "@/components/TbrEntryCard";
import { prisma } from "@/lib/prisma";
import { getActor, actorWhere, hasIdentity } from "@/lib/actor";
import { groupTags } from "@/lib/bookTags";

export default async function TbrPage() {
  const actor = await getActor();

  const entries = hasIdentity(actor)
    ? await prisma.tBREntry.findMany({
        where: actorWhere(actor),
        orderBy: { addedAt: "desc" },
        include: { book: { include: { tags: { include: { tag: true } } } } },
      })
    : [];

  // Mood-sorted living shelf (D36/roadmap Phase 2) — grouped by each book's
  // first mood tag rather than a flat list, so the shelf reads by vibe.
  const grouped = new Map<string, typeof entries>();
  for (const entry of entries) {
    const mood = groupTags(entry.book).mood[0] ?? "Other";
    grouped.set(mood, [...(grouped.get(mood) ?? []), entry]);
  }
  const sections = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex-1 px-4 py-10 sm:px-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <h1 className="font-serif text-3xl text-on-vibe">Your shelf</h1>
        <p className="mt-1 text-sm text-on-vibe-muted">
          {entries.length} book{entries.length === 1 ? "" : "s"} you&apos;ve matched with.
        </p>
        <Link href="/" className="mt-2 inline-block text-sm text-on-vibe-accent underline">
          Back to swiping
        </Link>
      </header>
      {entries.length === 0 ? (
        <p className="mx-auto max-w-6xl text-sm text-on-vibe-muted">
          Nothing here yet — swipe right on a few books to build your shelf.
        </p>
      ) : (
        <main className="mx-auto flex max-w-6xl flex-col gap-10">
          {sections.map(([mood, moodEntries]) => (
            <section key={mood}>
              <h2 className="mb-4 font-serif text-xl capitalize text-on-vibe">{mood}</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {moodEntries.map((entry) => (
                  <TbrEntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </main>
      )}
    </div>
  );
}
