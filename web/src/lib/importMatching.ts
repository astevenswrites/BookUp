import "server-only";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/actor";
import { getExcludedBookIds } from "@/lib/limits";
import type { ImportedRow } from "@/lib/importParsing";
import { normalizeTitle } from "@/lib/textNormalize";

// D82: CSV import from Goodreads/StoryGraph exports — the precise
// alternative to the author-first picker (D81) for readers who have a
// real reading history elsewhere. Both platforms offer a genuine, self-
// serve CSV export (confirmed directly, not assumed — see DECISIONS.md
// D82): Goodreads under My Books > Import and Export, StoryGraph under
// Manage Account > Manage Your Data. Neither requires developer/API
// access at all, which sidesteps the "no public read-import API" limit
// entirely — this is a personal data download, not a third-party
// integration.
//
// Server-only (Prisma, actor-scoped exclusion) — the pure parsing half
// (format detection, row shaping) lives in importParsing.ts instead, so a
// Client Component can use that half without pulling this one in too. See
// D32 for why that split matters.

function normalizeAuthor(author: string): string {
  return author.toLowerCase().trim();
}

// Only "read" rows go through matching — "currently-reading"/"to-read"
// rows aren't what this feature is for (avoiding re-showing books already
// read), and silently seeding someone's TBR from an import is a bigger,
// separate product decision than this pass makes.
export async function matchImportedBooks(actor: Actor, rows: ImportedRow[]) {
  const readRows = rows.filter((r) => r.status === "read" && r.title);
  const isbns = readRows.map((r) => r.isbn).filter((v): v is string => Boolean(v));

  const excludeBookIds = await getExcludedBookIds(actor);

  const byIsbn = isbns.length
    ? await prisma.book.findMany({
        where: { isbn: { in: isbns }, id: { notIn: excludeBookIds } },
        include: { tags: { include: { tag: true } } },
      })
    : [];

  const matchedIds = new Set(byIsbn.map((b) => b.id));
  const byIsbnValue = new Map(byIsbn.map((b) => [b.isbn, b]));

  // Title+author fallback only runs — and only pays for the full-catalog
  // fetch below — when at least one "read" row wasn't already covered by
  // an ISBN match. An import whose rows all carry ISBNs that matched
  // shouldn't pull the entire catalog just to find nothing left to do.
  const needsFallback = readRows.some((row) => !row.isbn || !byIsbnValue.has(row.isbn));

  const titleAuthorMatchIds = new Set<string>();
  if (needsFallback) {
    // Same normalized-title join technique used throughout this session's
    // catalog scripts (curate-featured.ts, scrub-childrens-books.ts, etc.).
    const allCandidates = await prisma.book.findMany({
      where: { id: { notIn: excludeBookIds } },
      select: { id: true, title: true, author: true },
    });

    const candidateIndex = new Map<string, { id: string }>();
    for (const c of allCandidates) {
      if (matchedIds.has(c.id)) continue;
      candidateIndex.set(`${normalizeTitle(c.title)}::${normalizeAuthor(c.author)}`, c);
    }

    for (const row of readRows) {
      if (row.isbn && byIsbnValue.has(row.isbn)) continue; // already matched by ISBN
      const key = `${normalizeTitle(row.title)}::${normalizeAuthor(row.author)}`;
      const match = candidateIndex.get(key);
      if (match) titleAuthorMatchIds.add(match.id);
    }
  }

  const byTitleAuthor = titleAuthorMatchIds.size
    ? await prisma.book.findMany({
        where: { id: { in: [...titleAuthorMatchIds] } },
        include: { tags: { include: { tag: true } } },
      })
    : [];

  const matched = [...byIsbn, ...byTitleAuthor];
  const unmatchedCount = readRows.length - matched.length;

  return { matched, unmatchedCount, totalReadRows: readRows.length };
}
