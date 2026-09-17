// Fallback cover-quality pass (D85) -- manual-run-only, never wired into any
// automated flow. Targets exactly the books backfill-covers-itunes.ts (D73)
// gave up on: iTunes' title/author search has no coverage for a lot of
// older backlist/print-only titles (confirmed directly: only 1 of 25
// checked resolved via ISBN lookup either -- see DECISIONS.md D85). Google
// Books turned out to have real coverage for exactly that population, with
// no rate limiting at all once an API key is used (its unauthenticated tier
// gave a hard zero-quota 429 on every request in this environment, same as
// D73 found for the bulk import).
//
//   GOOGLE_BOOKS_API_KEY=... npx tsx prisma/backfill-covers-google.ts
//
// Deliberately its own checkpoint file (cover-backfill-google.json), not
// shared with backfill-covers-itunes.ts's (cover-backfill.json) -- that
// file can be actively read/written by a still-running iTunes pass; this
// script only READS it, to find which books iTunes already confirmed it
// couldn't find, never writes to it.
//
// The naive approach -- take the first search result with a cover image --
// is not safe here: confirmed directly that Google's `intitle:`/`inauthor:`
// search is loose enough to return a completely different book by the same
// author when the exact title isn't found (6 different R.L. Stine titles
// all matched "Stay Out of the Basement" in an unfiltered test). Ports the
// same normalize + title/author candidate-filtering approach
// backfill-covers-itunes.ts already uses for exactly this reason.
//
// Resolution tradeoff, confirmed directly: Google's default thumbnail is
// only ~128x186px (worse than Open Library's D68 ceiling), but requesting
// zoom=3 on the same image gets ~575x836px -- better than Open Library,
// still short of iTunes' 800-1200px+ upscaled art. That's why this is a
// fallback, not a replacement for the iTunes pass.

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CATALOG_PATH = join(__dirname, "seed-data", "real-catalog.json");
const CHECKPOINT_DIR = join(__dirname, ".import-checkpoint");
const ITUNES_CHECKPOINT_PATH = join(CHECKPOINT_DIR, "cover-backfill.json");
const CHECKPOINT_PATH = join(CHECKPOINT_DIR, "cover-backfill-google.json");
// No rate limiting observed at all with an authenticated key (confirmed:
// 20/20 requests succeeded with no backoff at 500ms spacing) -- kept
// deliberately well under any plausible per-second cap anyway, since this
// is a one-off backfill, not a latency-sensitive path.
const REQUEST_DELAY_MS = 300;
const MAX_RETRIES = 8;
const MAX_BACKOFF_MS = 60000;

const API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

type RealCatalogBook = {
  title: string;
  author: string;
  coverUrl: string;
  needsReview: boolean;
  [key: string]: unknown;
};

type CheckpointEntry = { coverUrl: string | null };
type Checkpoint = Record<string, CheckpointEntry>;

type GBVolume = {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    language?: string;
    imageLinks?: Record<string, string>;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function searchGoogleBooks(title: string, author: string): Promise<GBVolume[]> {
  const params = new URLSearchParams({
    q: `intitle:${title} inauthor:${author}`,
    maxResults: "10",
    country: "US",
    key: API_KEY!,
  });
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
  if (res.status === 403 || res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) return [];
  const json = (await res.json()) as { items?: GBVolume[] };
  return json.items ?? [];
}

// Only bumps the zoom on a bare thumbnail -- a volume that already offers a
// small/medium/large/extraLarge tier is already bigger than a zoom=3
// thumbnail, so leave those alone.
function bestImageUrl(links: Record<string, string>): string {
  const tiered = links.extraLarge ?? links.large ?? links.medium ?? links.small;
  const raw = tiered ?? links.thumbnail ?? links.smallThumbnail;
  const upscaled = tiered ? raw : raw.replace(/([?&])zoom=\d+/, "$1zoom=3");
  return upscaled.replace(/^http:/, "https:");
}

async function findCover(title: string, author: string): Promise<string | null> {
  const items = await searchGoogleBooks(title, author);
  const normTitle = normalize(title);
  const normAuthor = normalize(author);

  const candidates = items.filter((it) => {
    const vi = it.volumeInfo;
    if (!vi?.title || !vi.authors?.length || !vi.imageLinks) return false;
    const rTitle = normalize(vi.title);
    const titleMatches = rTitle === normTitle || rTitle.includes(normTitle) || normTitle.includes(rTitle);
    const authorMatches = vi.authors.some((a) => {
      const rAuthor = normalize(a);
      return rAuthor.includes(normAuthor) || normAuthor.includes(rAuthor);
    });
    return titleMatches && authorMatches;
  });

  // Google exposes an explicit language code per volume -- more reliable
  // than iTunes' description-stopword heuristic (D73), used directly.
  const englishCandidate = candidates.find((c) => !c.volumeInfo?.language || c.volumeInfo.language === "en");
  const chosen = englishCandidate ?? candidates[0];
  if (!chosen?.volumeInfo?.imageLinks) return null;

  return bestImageUrl(chosen.volumeInfo.imageLinks);
}

async function main() {
  if (!API_KEY) {
    throw new Error("GOOGLE_BOOKS_API_KEY is not set in .env");
  }
  mkdirSync(CHECKPOINT_DIR, { recursive: true });

  const catalog: RealCatalogBook[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const itunesCheckpoint: Checkpoint = existsSync(ITUNES_CHECKPOINT_PATH)
    ? JSON.parse(readFileSync(ITUNES_CHECKPOINT_PATH, "utf8"))
    : {};

  const limit = process.env.COVER_BACKFILL_LIMIT ? parseInt(process.env.COVER_BACKFILL_LIMIT, 10) : Infinity;
  const targets = catalog
    .filter((b) => {
      const key = `${b.title}::${b.author}`;
      // Only books iTunes explicitly confirmed it couldn't find -- not ones
      // it hasn't gotten to yet (that pass may still be running), and not
      // ones it already found a good cover for.
      return b.needsReview && itunesCheckpoint[key] && !itunesCheckpoint[key].coverUrl;
    })
    .slice(0, limit);

  console.log(`${targets.length} books iTunes confirmed it couldn't find a cover for.`);

  const checkpoint: Checkpoint = existsSync(CHECKPOINT_PATH)
    ? JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"))
    : {};

  let found = 0;
  let notFound = 0;

  for (const [i, book] of targets.entries()) {
    const key = `${book.title}::${book.author}`;
    if (key in checkpoint) continue;

    let coverUrl: string | null = null;
    let retries = 0;
    let exhausted = false;
    while (retries < MAX_RETRIES) {
      try {
        coverUrl = await findCover(book.title, book.author);
        break;
      } catch (e) {
        const isRateLimit = e instanceof Error && e.message === "RATE_LIMITED";
        const backoff = Math.min(5000 * 2 ** retries, MAX_BACKOFF_MS);
        const reason = isRateLimit ? "Rate limited" : `Network error (${(e as Error).message})`;
        console.log(`${reason}, backing off ${backoff}ms... (${book.title})`);
        await sleep(backoff);
        retries++;
        if (retries >= MAX_RETRIES) exhausted = true;
        continue;
      }
    }

    if (exhausted) {
      notFound++;
      console.log(`Giving up after ${MAX_RETRIES} retries, will retry next run: ${book.title}`);
    } else {
      checkpoint[key] = { coverUrl };
      if (coverUrl) found++;
      else notFound++;
    }

    if ((i + 1) % 50 === 0) {
      writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
      console.log(`  ${i + 1}/${targets.length} processed (${found} found, ${notFound} not found)`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
  console.log(`\nGoogle fallback pass done. Found: ${found}, still not found: ${notFound}.`);

  let applied = 0;
  for (const book of targets) {
    const entry = checkpoint[`${book.title}::${book.author}`];
    if (entry?.coverUrl) {
      book.coverUrl = entry.coverUrl;
      applied++;
    }
  }
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
  console.log(`Applied ${applied} new cover URLs to ${CATALOG_PATH}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
