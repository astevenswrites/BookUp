// One-off curation pass (D70) — manual-run-only, never wired into any
// automated flow. Flags a "featured" subset of the real-import catalog for
// /review ("Peek at the deck") so it showcases well-known and recently-
// popular real books instead of a plain random sample.
//
// IMPORTANT: `featured` is a boolean editorial flag, not a rating — it is
// derived here from Open Library's ratings-derived popularity count (the
// same transient signal Pass 1 of import-open-library.ts already used to
// pick which books to bother importing), but that raw number is never
// itself written to the catalog or the database. See D67/[[feedback_no_
// ratings_reviews]]: no rating/review value may ever reach the schema or UI.
//
//   npx tsx prisma/curate-featured.ts
//
// Source of the popularity signal: prisma/.import-checkpoint/selected-
// works.json, the Pass 2 checkpoint written by import-open-library.ts
// (title, genre, popularity per selected work, pre-edition-enrichment).
// Joined back to prisma/seed-data/real-catalog.json by normalized title
// (falling back to same-genre substring containment, since the catalog's
// final titles come from the matched edition record, D69, which can differ
// slightly from the work's own title).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeTitle } from "../src/lib/textNormalize";

const CHECKPOINT_PATH = join(
  __dirname,
  ".import-checkpoint",
  "selected-works.json",
);
const CATALOG_PATH = join(__dirname, "seed-data", "real-catalog.json");

const CLASSIC_PER_GENRE = 6;
const RECENT_PER_GENRE = 6;
const RECENT_YEAR_CUTOFF = 2016;

type SelectedWork = {
  key: string;
  title: string;
  genre: string;
  popularity: number;
};

type CatalogEntry = {
  title: string;
  author: string;
  genre: string;
  publishedYear: number;
  featured?: boolean;
  [key: string]: unknown;
};

function main() {
  const selectedWorks: SelectedWork[] = JSON.parse(
    readFileSync(CHECKPOINT_PATH, "utf8"),
  );
  const catalog: CatalogEntry[] = JSON.parse(
    readFileSync(CATALOG_PATH, "utf8"),
  );

  // Reset any prior run's flags so this script stays idempotent.
  for (const entry of catalog) entry.featured = false;

  const catalogByNormTitle = new Map<string, CatalogEntry[]>();
  for (const entry of catalog) {
    const norm = normalizeTitle(entry.title);
    const bucket = catalogByNormTitle.get(norm);
    if (bucket) bucket.push(entry);
    else catalogByNormTitle.set(norm, [entry]);
  }

  function findCatalogMatch(work: SelectedWork): CatalogEntry | undefined {
    const norm = normalizeTitle(work.title);
    const direct = catalogByNormTitle.get(norm);
    if (direct) {
      return direct.find((e) => e.genre === work.genre) ?? direct[0];
    }
    for (const entry of catalog) {
      if (entry.genre !== work.genre) continue;
      const entryNorm = normalizeTitle(entry.title);
      if (entryNorm.includes(norm) || norm.includes(entryNorm)) return entry;
    }
    return undefined;
  }

  const byGenre = new Map<string, SelectedWork[]>();
  for (const work of selectedWorks) {
    const bucket = byGenre.get(work.genre);
    if (bucket) bucket.push(work);
    else byGenre.set(work.genre, [work]);
  }

  let classicCount = 0;
  let recentCount = 0;
  let unmatched = 0;

  for (const [, works] of byGenre) {
    const byPopularity = [...works].sort((a, b) => b.popularity - a.popularity);

    let picked = 0;
    for (const work of byPopularity) {
      if (picked >= CLASSIC_PER_GENRE) break;
      const match = findCatalogMatch(work);
      if (!match) {
        unmatched++;
        continue;
      }
      if (match.featured) continue;
      match.featured = true;
      picked++;
      classicCount++;
    }

    picked = 0;
    for (const work of byPopularity) {
      if (picked >= RECENT_PER_GENRE) break;
      const match = findCatalogMatch(work);
      if (!match || match.featured) continue;
      if (match.publishedYear < RECENT_YEAR_CUTOFF) continue;
      match.featured = true;
      picked++;
      recentCount++;
    }
  }

  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));

  const totalFeatured = catalog.filter((e) => e.featured).length;
  console.log(
    `Classic-featured: ${classicCount}, recent-featured: ${recentCount}, ` +
      `unmatched selection-pass works: ${unmatched}, total featured: ${totalFeatured}/${catalog.length}`,
  );
}

main();
