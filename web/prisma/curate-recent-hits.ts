// One-off curation pass (D72) — manual-run-only, additive, never wired
// into any automated flow.
//
// D70's "recent" featured bucket ranked by Open Library's ratings-derived
// popularity, same as the "classic" bucket. That signal is stale/library-
// skewed: it reflects decades of library holds and catalog activity, not
// the BookTok-driven boom of the last ~5 years. Spot-checked after the
// user flagged this (naming Throne of Glass as a clear miss): Fourth Wing,
// Throne of Glass, A Court of Mist and Fury, Six of Crows, and The Cruel
// Prince were all already in the catalog and NOT featured — every one of
// them outranked by decades-old library classics in raw popularity count.
// No amount of re-tuning that ranking fixes this; it's the wrong signal
// for "recently popular." Hand-curated instead, same approach as the indie
// authors pass (D70): a real list of known 2012-2025 hits, marked featured
// if already in the catalog, fetched via the live API (same as indie
// picks — small targeted list, not bulk) if missing entirely.
//
//   npx tsx prisma/curate-recent-hits.ts

import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeTitle } from "../src/lib/textNormalize";
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

// Already-imported books that should be featured but weren't, because OL
// popularity ranked them below older library classics in their genre.
const MARK_FEATURED: { title: string; author: string }[] = [
  { title: "Throne of Glass", author: "Sarah J. Maas" },
  { title: "A Court of Mist and Fury", author: "Sarah J. Maas" },
  { title: "Fourth Wing", author: "Rebecca Yarros" },
  { title: "The Cruel Prince", author: "Holly Black" },
  { title: "Six of Crows", author: "Leigh Bardugo" },
  { title: "Powerless", author: "Lauren Roberts" },
  { title: "Ugly Love", author: "Colleen Hoover" },
  { title: "Confess", author: "Colleen Hoover" },
  { title: "Beach Read", author: "Emily Henry" },
  { title: "The Hating Game", author: "Sally Thorne" },
  { title: "Gone Girl", author: "Gillian Flynn" },
  { title: "The Girl on the Train", author: "Paula Hawkins" },
];

// Well-known recent hits not in the catalog at all — fetched individually
// via Open Library's live Search + Works APIs (a couple dozen requests,
// not bulk scraping), same mechanism as import-indie-picks.ts. Genre is
// asserted rather than detected, for the same reason as the indie list:
// these are chosen for a specific showcase slot, not discovered.
const FETCH_LIST: { title: string; author: string; genre: string }[] = [
  { title: "Heir of Fire", author: "Sarah J. Maas", genre: "Fantasy" },
  { title: "Queen of Shadows", author: "Sarah J. Maas", genre: "Fantasy" },
  { title: "A Court of Wings and Ruin", author: "Sarah J. Maas", genre: "Romantasy" },
  { title: "A Court of Silver Flames", author: "Sarah J. Maas", genre: "Romantasy" },
  { title: "Iron Flame", author: "Rebecca Yarros", genre: "Fantasy" },
  { title: "Legends & Lattes", author: "Travis Baldree", genre: "Fantasy" },
  { title: "Divine Rivals", author: "Rebecca Ross", genre: "Romantasy" },
  { title: "Shadow and Bone", author: "Leigh Bardugo", genre: "Fantasy" },
  { title: "Serpent and Dove", author: "Shelby Mahurin", genre: "Romantasy" },
  { title: "Babel", author: "R.F. Kuang", genre: "Fantasy" },
  { title: "The Poppy War", author: "R.F. Kuang", genre: "Fantasy" },
  { title: "House of Earth and Blood", author: "Sarah J. Maas", genre: "Romantasy" },
  { title: "Caraval", author: "Stephanie Garber", genre: "Fantasy" },
  { title: "The Atlas Six", author: "Olivie Blake", genre: "Fantasy" },
  { title: "The Bone Season", author: "Samantha Shannon", genre: "Sci-Fi" },
  { title: "A Deadly Education", author: "Naomi Novik", genre: "Fantasy" },
  { title: "November 9", author: "Colleen Hoover", genre: "Romance" },
  { title: "Reminders of Him", author: "Colleen Hoover", genre: "Romance" },
  { title: "The Love Hypothesis", author: "Ali Hazelwood", genre: "Romance" },
  { title: "Icebreaker", author: "Hannah Grace", genre: "Romance" },
  { title: "People We Meet on Vacation", author: "Emily Henry", genre: "Romance" },
  { title: "Red, White & Royal Blue", author: "Casey McQuiston", genre: "Romance" },
  { title: "The Silent Patient", author: "Alex Michaelides", genre: "Thriller" },
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

  let markedCount = 0;
  for (const pick of MARK_FEATURED) {
    const match = catalog.find(
      (b) => normalizeTitle(b.title) === normalizeTitle(pick.title) && b.author === pick.author,
    );
    if (!match) {
      console.log(`Not found in catalog (expected to mark featured): ${pick.title} by ${pick.author}`);
      continue;
    }
    if (!match.featured) {
      match.featured = true;
      markedCount++;
    }
  }
  console.log(`Marked ${markedCount} already-imported books as featured.`);

  const existingKeys = new Set(catalog.map((b) => `${normalizeTitle(b.title)}::${b.author.toLowerCase()}`));
  const { tropes, moods } = await loadExistingVocab();

  let added = 0;
  let skipped = 0;
  let notFound = 0;

  for (const pick of FETCH_LIST) {
    const dedupeKey = `${normalizeTitle(pick.title)}::${pick.author.toLowerCase()}`;
    if (existingKeys.has(dedupeKey)) {
      console.log(`Already in catalog, skipping fetch: ${pick.title} by ${pick.author}`);
      skipped++;
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
  console.log(
    `\nDone. Marked ${markedCount} existing, added ${added}, skipped ${skipped} already-present, ${notFound} not found/unusable.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
