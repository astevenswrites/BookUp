import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { prisma } from "@/lib/prisma";
import { getSessionId } from "@/lib/session";

export default async function TbrPage() {
  const sessionId = await getSessionId();

  const entries = sessionId
    ? await prisma.tBREntry.findMany({
        where: { sessionId },
        orderBy: { addedAt: "desc" },
        include: { book: { include: { tags: { include: { tag: true } } } } },
      })
    : [];

  return (
    <div className="flex-1 px-4 py-10 sm:px-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <h1 className="font-serif text-3xl text-foreground">Your shelf</h1>
        <p className="mt-1 text-sm text-muted">
          {entries.length} book{entries.length === 1 ? "" : "s"} you&apos;ve matched with.
        </p>
        <Link href="/" className="mt-2 inline-block text-sm text-accent underline">
          Back to swiping
        </Link>
      </header>
      {entries.length === 0 ? (
        <p className="mx-auto max-w-6xl text-sm text-muted">
          Nothing here yet — swipe right on a few books to build your shelf.
        </p>
      ) : (
        <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {entries.map((entry) => (
            <BookCard key={entry.id} book={entry.book} />
          ))}
        </main>
      )}
    </div>
  );
}
