// One-off, hand-curated addition (D70) to the real catalog — manual-run-
// only, additive, never wired into any automated flow.
//
// The bulk-dump import (import-open-library.ts) selects by Open Library's
// ratings-derived popularity, which is dominated by library-cataloged/
// traditionally-published books. Self-published and small-press "indie"
// bestsellers — huge on BookTok/Kindle/Goodreads, especially in romance —
// are barely represented there (spot-checked: only 2 of 15 well-known indie
// authors had even a single title survive the bulk selection). This script
// hand-picks well-known indie authors and pulls their signature titles
// individually via Open Library's live Search + Works APIs, tags them the
// same way the bulk import does, and appends them to the catalog flagged
// featured: true so /review ("Peek at the deck") surfaces them.
//
// Only ~2 requests per title (a small, targeted list below) — nowhere near
// bulk-scraping territory, so the live API (not a dump) is the right tool
// here; paced at 1 req/sec, Open Library's default unauthenticated limit
// (no contact email in the User-Agent, per the user's earlier call).
//
//   npx tsx prisma/import-indie-picks.ts
//
// Popularity/rating signals never enter this pipeline at all — these are
// picked by hand, not ranked by any score — and nothing here writes a
// rating or review count anywhere (D67 / [[feedback_no_ratings_reviews]]).

import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  USER_AGENT,
  MAX_BLURB_LENGTH,
  detectGenre,
  extractDescription,
  deriveHookLine,
  loadExistingVocab,
  matchVocab,
  isLikelyChildrensBook,
  type RealCatalogBook,
} from "./import-open-library";

const CATALOG_PATH = join(__dirname, "seed-data", "real-catalog.json");
const REQUEST_DELAY_MS = 1100;
const DEFAULT_PAGE_COUNT = 350;

// Hand-picked: well-known indie/self-published authors who sell heavily
// (BookTok, Kindle Unlimited, Goodreads) but skew invisible in library-
// catalog-driven popularity data. Genre is asserted here rather than
// detected — these are chosen deliberately for a specific showcase slot,
// so we don't want a subjects-keyword miss silently dropping one into the
// wrong bucket or getting skipped for having no genre match at all.
const INDIE_PICKS: { title: string; author: string; genre: string }[] = [
  { title: "Twisted Love", author: "Ana Huang", genre: "Romance" },
  { title: "Deviant King", author: "Rina Kent", genre: "Romance" },
  { title: "Sunshine", author: "Meagan Brandy", genre: "Romance" },
  { title: "Vicious", author: "Emily McIntire", genre: "Romance" },
  { title: "Ten Tiny Breaths", author: "K.A. Tucker", genre: "Romance" },
  { title: "The Kingmaker", author: "Kennedy Ryan", genre: "Romance" },
  { title: "Fallen Crest High", author: "Tijan", genre: "Romance" },
  { title: "Flawless", author: "Elsie Silver", genre: "Romance" },
  { title: "Things We Never Got Over", author: "Lucy Score", genre: "Romance" },
  { title: "The Bet", author: "Rachel Van Dyken", genre: "Romance" },
  { title: "Endgame", author: "Skye Warren", genre: "Romance" },
  { title: "Pucked", author: "Helena Hunting", genre: "Romance" },
  { title: "Neon Gods", author: "Katee Robert", genre: "Romantasy" },
  { title: "Angry God", author: "L.J. Shen", genre: "Romance" },
  { title: "The Serpent and the Wings of Night", author: "Carissa Broadbent", genre: "Romantasy" },
  { title: "The Bridge Kingdom", author: "Danielle L. Jensen", genre: "Fantasy" },
  { title: "Gild", author: "Raven Kennedy", genre: "Fantasy" },
  { title: "The Housemaid", author: "Freida McFadden", genre: "Thriller" },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SearchResult = {
  key: string;
  title: string;
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
};

async function searchWork(title: string, author: string): Promise<SearchResult | null> {
  const params = new URLSearchParams({
    title,
    author,
    fields: "key,title,cover_i,first_publish_year,number_of_pages_median,subject",
    limit: "1",
  });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { docs?: SearchResult[] };
  return json.docs?.[0] ?? null;
}

async function fetchWorkDetails(
  workKey: string,
): Promise<{ description: string | null; subjects: string[]; covers: number[] }> {
  const res = await fetch(`https://openlibrary.org${workKey}.json`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return { description: null, subjects: [], covers: [] };
  const json = (await res.json()) as {
    description?: unknown;
    subjects?: string[];
    covers?: number[];
  };
  return {
    description: extractDescription(json.description),
    subjects: json.subjects ?? [],
    covers: json.covers ?? [],
  };
}

async function main() {
  const catalog: RealCatalogBook[] = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const existingKeys = new Set(catalog.map((b) => `${b.title.toLowerCase()}::${b.author.toLowerCase()}`));
  const { tropes, moods } = await loadExistingVocab();

  let added = 0;
  let skippedExisting = 0;
  let notFound = 0;

  for (const pick of INDIE_PICKS) {
    const dedupeKey = `${pick.title.toLowerCase()}::${pick.author.toLowerCase()}`;
    if (existingKeys.has(dedupeKey)) {
      console.log(`Already in catalog, skipping: ${pick.title} by ${pick.author}`);
      skippedExisting++;
      continue;
    }

    const searchResult = await searchWork(pick.title, pick.author);
    await sleep(REQUEST_DELAY_MS);
    if (!searchResult) {
      console.log(`Not found on Open Library: ${pick.title} by ${pick.author}`);
      notFound++;
      continue;
    }

    const details = await fetchWorkDetails(searchResult.key);
    await sleep(REQUEST_DELAY_MS);

    const description = details.description;
    if (!description) {
      console.log(`No description available, skipping: ${pick.title} by ${pick.author}`);
      notFound++;
      continue;
    }

    const subjects = details.subjects.length > 0 ? details.subjects : searchResult.subject ?? [];
    if (isLikelyChildrensBook(searchResult.title || pick.title, subjects, pick.author)) {
      console.log(`Skipped, looks like a children's book: ${pick.title} by ${pick.author}`);
      notFound++;
      continue;
    }

    const coverId = details.covers[0] ?? searchResult.cover_i;
    if (!coverId) {
      console.log(`No cover available, skipping: ${pick.title} by ${pick.author}`);
      notFound++;
      continue;
    }

    const detectedGenre = detectGenre(subjects);
    const book: RealCatalogBook = {
      title: searchResult.title || pick.title,
      author: pick.author,
      hookLine: deriveHookLine(description),
      blurb: description.length > MAX_BLURB_LENGTH ? `${description.slice(0, MAX_BLURB_LENGTH)}...` : description,
      compTitle: null,
      coverUrl: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
      heatLevel: "none",
      pacing: "medium",
      pageCount: searchResult.number_of_pages_median ?? DEFAULT_PAGE_COUNT,
      publishedYear: searchResult.first_publish_year ?? new Date().getFullYear(),
      genre: pick.genre,
      tropes: matchVocab(subjects, tropes),
      moods: matchVocab(subjects, moods),
      contentWarnings: [],
      needsReview: true,
      featured: true,
    };

    catalog.push(book);
    existingKeys.add(dedupeKey);
    added++;
    console.log(
      `Added: ${book.title} by ${book.author} (${book.genre}, detected: ${detectedGenre ?? "none"})`,
    );
  }

  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
  console.log(`\nDone. Added ${added}, skipped ${skippedExisting} already-present, ${notFound} not found/unusable.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
