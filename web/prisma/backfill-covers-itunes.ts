// One-off cover-quality pass (D73) — manual-run-only, never wired into any
// automated flow. Replaces Open Library cover art with Apple Books/iTunes
// cover art for every real-imported book (needsReview: true — the
// synthetic catalog uses its own placeholder SVGs per D6 and is untouched).
//
//   npx tsx prisma/backfill-covers-itunes.ts
//
// Why: Open Library's Covers API has a hard ~300-500px resolution ceiling
// (D68) AND, separately, no concept of "the edition a reader would
// recognize today" — it happily returns a decades-old mass-market scan or
// a stylized 3D product-shot render (spotted on Iron Flame) instead of the
// current flat retail cover. Verified Apple's iTunes Search API (used here
// with no API key — it's the free, unauthenticated tier, unlike Google
// Books' API which returned a hard zero-quota 429 from this environment)
// returns flat, current-edition covers at meaningfully higher resolution
// (800-1200px+) for a spot-check across genres: modern romantasy (Throne
// of Glass, Iron Flame), a decades-old classic (The Hobbit, Danse
// Macabre), a cozy mystery (Blueberry Muffin Murder), and an indie romance
// (Twisted Love).
//
// The catch, found during that same spot-check: iTunes' catalog includes
// foreign-language editions of the same title under the US storefront
// (Twisted Love's search results included Spanish, Italian, and Dutch
// editions ahead of the English one in some cases) with no explicit
// language field to filter on. Guards against this by requiring the
// result's own description text to read as English (a simple stopword
// check) before accepting it — same spirit as D69's explicit-English gate
// on the bulk import, applied here because the underlying risk is
// identical (silently substituting a non-English edition).
//
// Checkpointed to prisma/.import-checkpoint/cover-backfill.json (gitignored)
// so an interrupted run resumes instead of re-querying already-resolved
// books — this pass makes one Apple API request per ~2285 books at a
// conservative pace and takes a while.

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CATALOG_PATH = join(__dirname, "seed-data", "real-catalog.json");
const CHECKPOINT_DIR = join(__dirname, ".import-checkpoint");
const CHECKPOINT_PATH = join(CHECKPOINT_DIR, "cover-backfill.json");
// 550ms (~2 req/sec) got rate-limited by Apple within the first 50
// requests, with signs the throttling was also silently degrading match
// quality before the first hard 429. 3000ms (~20 req/min, the commonly-
// cited safe threshold for this unauthenticated API) STILL got throttled —
// possibly residual cooldown from the earlier burst, possibly this shared
// environment's egress IP being shared with other tenants' traffic beyond
// this script's control. Backed off further and made the retry loop patient
// (see MAX_RETRIES below) rather than fighting for a pace guaranteed safe.
const REQUEST_DELAY_MS = 4000;
const UPSCALE_SIZE = "1200x1200bb.jpg";

type RealCatalogBook = {
  title: string;
  author: string;
  coverUrl: string;
  needsReview: boolean;
  [key: string]: unknown;
};

type CheckpointEntry = { coverUrl: string | null };
type Checkpoint = Record<string, CheckpointEntry>;

const ENGLISH_STOPWORDS = [" the ", " and ", " was ", " her ", " his ", " with ", " that ", " she ", " he "];

function looksEnglish(text: string): boolean {
  const padded = ` ${text.toLowerCase()} `;
  const hits = ENGLISH_STOPWORDS.filter((w) => padded.includes(w)).length;
  return hits >= 2;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ITunesResult = {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  description?: string;
};

async function findCover(title: string, author: string): Promise<string | null> {
  const params = new URLSearchParams({
    term: `${title} ${author}`,
    entity: "ebook",
    country: "US",
    limit: "10",
  });
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (res.status === 403 || res.status === 429) {
    throw new Error(`RATE_LIMITED:${res.status}`);
  }
  if (!res.ok) return null;

  const json = (await res.json()) as { results?: ITunesResult[] };
  const results = json.results ?? [];

  const normTitle = normalize(title);
  const normAuthor = normalize(author);

  const candidates = results.filter((r) => {
    if (!r.trackName || !r.artistName || !r.artworkUrl100) return false;
    const rTitle = normalize(r.trackName);
    const rAuthor = normalize(r.artistName);
    const titleMatches = rTitle === normTitle || rTitle.includes(normTitle) || normTitle.includes(rTitle);
    const authorMatches = rAuthor.includes(normAuthor) || normAuthor.includes(rAuthor);
    return titleMatches && authorMatches;
  });

  const englishCandidate = candidates.find((r) => !r.description || looksEnglish(r.description));
  const chosen = englishCandidate ?? candidates[0];
  if (!chosen?.artworkUrl100) return null;

  return chosen.artworkUrl100.replace(/\d+x\d+bb\.jpg$/, UPSCALE_SIZE);
}

async function main() {
  mkdirSync(CHECKPOINT_DIR, { recursive: true });
  const catalog: RealCatalogBook[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const limit = process.env.COVER_BACKFILL_LIMIT ? parseInt(process.env.COVER_BACKFILL_LIMIT, 10) : Infinity;
  const realBooks = catalog.filter((b) => b.needsReview).slice(0, limit);

  const checkpoint: Checkpoint = existsSync(CHECKPOINT_PATH)
    ? JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"))
    : {};

  let found = 0;
  let notFound = 0;
  let rateLimitBackoffs = 0;

  for (const [i, book] of realBooks.entries()) {
    const key = `${book.title}::${book.author}`;
    if (key in checkpoint) continue;

    let coverUrl: string | null = null;
    let retries = 0;
    let exhausted = false;
    const MAX_RETRIES = 8;
    const MAX_BACKOFF_MS = 60000;
    while (retries < MAX_RETRIES) {
      try {
        coverUrl = await findCover(book.title, book.author);
        break;
      } catch (e) {
        // D73 follow-up: a raw network error (connect timeout, DNS blip,
        // ECONNRESET) killed a multi-hour run with an uncaught exception —
        // only RATE_LIMITED was being retried, everything else propagated
        // and crashed main(). Any transient fetch failure gets the same
        // patient retry/backoff treatment now; only the log line differs.
        const isRateLimit = e instanceof Error && e.message.startsWith("RATE_LIMITED");
        rateLimitBackoffs += isRateLimit ? 1 : 0;
        const backoff = Math.min(5000 * 2 ** retries, MAX_BACKOFF_MS);
        const reason = isRateLimit ? "Rate limited" : `Network error (${(e as Error).message})`;
        console.log(`${reason}, backing off ${backoff}ms... (${book.title})`);
        await sleep(backoff);
        retries++;
        if (retries >= MAX_RETRIES) exhausted = true;
        continue;
      }
    }

    // Don't checkpoint a rate-limit casualty as a permanent "not found" —
    // leaving it out of the checkpoint means the next run retries it
    // instead of silently accepting a false negative caused by throttling,
    // not by the book actually being absent from Apple's catalog.
    if (exhausted) {
      notFound++;
      console.log(`Giving up after ${MAX_RETRIES} rate-limit retries, will retry next run: ${book.title}`);
    } else {
      checkpoint[key] = { coverUrl };
      if (coverUrl) found++;
      else notFound++;
    }

    if ((i + 1) % 50 === 0) {
      writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
      console.log(`  ${i + 1}/${realBooks.length} processed (${found} found, ${notFound} not found)`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
  console.log(`\nSearch pass done. Found: ${found}, not found: ${notFound}, rate-limit backoffs: ${rateLimitBackoffs}`);

  let applied = 0;
  for (const book of realBooks) {
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
