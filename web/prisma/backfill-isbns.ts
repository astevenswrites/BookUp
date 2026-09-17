// One-off enrichment pass (D82) — manual-run-only, never wired into any
// automated flow. Backfills Book.isbn for every real-imported book that
// doesn't have one yet.
//
//   npx tsx prisma/backfill-isbns.ts
//
// Why this is even possible without a fresh full import: the original
// bulk import (import-open-library.ts) already required a real ISBN to
// accept an edition at all (see EditionInfo/enrichWithEditions) — it just
// never made it into the persisted schema (D82 added the column). Rather
// than re-streaming the ~9.2GB editions dump again just to recover a value
// that was already found once, this does targeted live-API lookups
// per book — the same justification already used for D70/D72/D73's live-
// API passes (a few thousand targeted requests, not bulk scraping), joined
// back to the original work via the Pass 2 selection checkpoint
// (selected-works.json, has the Open Library work key per book, keyed by
// normalized title — same join technique as curate-featured.ts).
//
// Same explicit-English gate as D69 (the original import's title/language
// fix): a missing `languages` field is NOT treated as English. Getting
// this wrong here would silently attach a foreign-language edition's ISBN
// to an English book record.

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { USER_AGENT } from "./import-open-library";
import { normalizeTitle } from "../src/lib/textNormalize";
import { toIsbn13 } from "../src/lib/isbn";

const CHECKPOINT_PATH = join(__dirname, ".import-checkpoint", "isbn-backfill.json");
const WORKS_CHECKPOINT_PATH = join(__dirname, ".import-checkpoint", "selected-works.json");
const REQUEST_DELAY_MS = 1100; // matches the pacing already established safe for Open Library's live API this session
const MAX_RETRIES = 6;
const MAX_BACKOFF_MS = 30000;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type EditionsResponse = {
  entries?: { isbn_13?: string[]; isbn_10?: string[]; languages?: { key: string }[] }[];
};

async function findIsbn(workKey: string): Promise<string | null> {
  const res = await fetch(`https://openlibrary.org${workKey}/editions.json?limit=50`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (res.status === 403 || res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) return null;

  const json = (await res.json()) as EditionsResponse;
  for (const edition of json.entries ?? []) {
    const isEnglish = edition.languages?.some((l) => l.key === "/languages/eng");
    if (!isEnglish) continue;
    const isbn13 = edition.isbn_13?.[0] ? toIsbn13(edition.isbn_13[0]) : null;
    const isbn10 = edition.isbn_10?.[0] ? toIsbn13(edition.isbn_10[0]) : null;
    const isbn = isbn13 ?? isbn10;
    if (isbn) return isbn;
  }
  return null;
}

async function main() {
  const limit = process.env.ISBN_BACKFILL_LIMIT ? parseInt(process.env.ISBN_BACKFILL_LIMIT, 10) : undefined;
  const books = await prisma.book.findMany({
    where: { needsReview: true, isbn: null },
    select: { id: true, title: true, author: true },
    take: limit,
  });
  console.log(`${books.length} real-imported books missing an ISBN.`);

  const works: { key: string; title: string }[] = JSON.parse(readFileSync(WORKS_CHECKPOINT_PATH, "utf8"));
  const worksByNormTitle = new Map<string, string>(); // normalized title -> work key
  for (const w of works) {
    const norm = normalizeTitle(w.title);
    if (!worksByNormTitle.has(norm)) worksByNormTitle.set(norm, w.key);
  }

  const checkpoint: Record<string, string | null> = existsSync(CHECKPOINT_PATH)
    ? JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"))
    : {};

  let found = 0;
  let noWorkMatch = 0;
  let noEnglishIsbn = 0;

  for (const [i, book] of books.entries()) {
    if (book.id in checkpoint) continue;

    const workKey = worksByNormTitle.get(normalizeTitle(book.title));
    if (!workKey) {
      checkpoint[book.id] = null;
      noWorkMatch++;
      continue;
    }

    let isbn: string | null = null;
    let retries = 0;
    let exhausted = false;
    while (retries < MAX_RETRIES) {
      try {
        isbn = await findIsbn(workKey);
        break;
      } catch {
        const backoff = Math.min(3000 * 2 ** retries, MAX_BACKOFF_MS);
        console.log(`Rate limited, backing off ${backoff}ms... (${book.title})`);
        await sleep(backoff);
        retries++;
        if (retries >= MAX_RETRIES) exhausted = true;
      }
    }

    if (exhausted) {
      console.log(`Giving up after ${MAX_RETRIES} retries, will retry next run: ${book.title}`);
      await sleep(REQUEST_DELAY_MS);
      continue; // not checkpointed — retried on next run, same pattern as backfill-covers-itunes.ts
    }

    checkpoint[book.id] = isbn;
    if (isbn) {
      found++;
      await prisma.book.update({ where: { id: book.id }, data: { isbn } });
    } else {
      noEnglishIsbn++;
    }

    if ((i + 1) % 50 === 0) {
      writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
      console.log(`  ${i + 1}/${books.length} processed (${found} found)`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
  console.log(
    `\nDone. Found: ${found}, no matching work in checkpoint: ${noWorkMatch}, no explicit-English ISBN: ${noEnglishIsbn}.`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
