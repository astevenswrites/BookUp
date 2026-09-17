import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// D80: deliberately public — no auth check. The whole point of a share
// link is that whoever it's sent to (who may have never used BookUp) can
// open it and see something real, with the og:image (opengraph-image.tsx,
// same route segment) rendering natively when the link is pasted into
// iMessage/X/Discord/etc. This page is what a human clicking through
// actually lands on; the image is what shows up in the preview beforehand.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ bookId: string }>;
}): Promise<Metadata> {
  const { bookId } = await params;
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { title: true, author: true } });
  if (!book) return { title: "BookUp" };

  return {
    title: `I matched with ${book.title} — BookUp`,
    description: `${book.title} by ${book.author}. Find your next match at BookUp.`,
  };
}

export default async function SharePage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { title: true, author: true, hookLine: true, coverUrl: true },
  });
  if (!book) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-vibe-accent">
        Someone just matched with
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- share preview, not app UI, no BookCard chrome wanted here */}
      <img
        src={book.coverUrl}
        alt={`Cover of ${book.title}`}
        className="w-48 rounded-2xl object-cover shadow-lg"
      />
      <div>
        <h1 className="font-serif text-2xl text-on-vibe">{book.title}</h1>
        <p className="mt-1 text-sm text-on-vibe-muted">{book.author}</p>
      </div>
      <p className="text-sm text-on-vibe-muted">{book.hookLine}</p>
      <Link
        href="/"
        className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground shadow-lg"
      >
        Find your next match
      </Link>
    </div>
  );
}
