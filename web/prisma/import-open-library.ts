// Real catalog import (D66) — manual-run-only, same convention as
// generate-catalog.ts/seed-dev-community.ts. NEVER wired into postinstall
// or any automated flow.
//
//   npx tsx prisma/import-open-library.ts
//
// Pulls ~2,500 real books from Open Library's monthly bulk data dumps
// (not the live Search API — confirmed the Search API has no description
// field even with fields=*, so it can't avoid a large-volume fetch either;
// the dumps are what Open Library publishes bulk access FOR, unlike their
// rate-limited live API). Writes prisma/seed-data/real-catalog.json — a
// SEPARATE fixture from the existing synthetic seed-data/catalog.json,
// deliberately not touching it. Genre is inferred from Open Library's messy
// "subjects" free-text list via a hand-authored keyword table; trope/mood
// get a best-effort substring match against the vocab this project already
// seeded from the synthetic catalog (LOW recall expected — that's fine,
// this is the "best we can do automatically" pass, not the finished one).
// heatLevel/pacing/content_warning have no signal in the source data at
// all, so they get a safe placeholder rather than a guess — every imported
// book is written with needsReview: true for a human pass later (D66).
//
// Streams each dump (HTTPS -> gunzip -> line reader), never saves the raw
// multi-GB files to disk. Total download ~12.5GB across all four dumps;
// expect 30-90+ minutes depending on bandwidth. The works-pass selection is
// checkpointed to disk before the (much larger) editions pass starts, so a
// network failure on the editions dump doesn't cost re-downloading works too.

import "dotenv/config";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { PrismaClient, TagCategory } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const USER_AGENT = "BookUp-CatalogImport/1.0"; // no personal contact info, per the user's call
const DUMP_BASE = "https://openlibrary.org/data";
const TARGET_PER_GENRE = 210; // ~210 * 12 genres ≈ 2,500
const CANDIDATE_CAP_PER_GENRE = 500; // bounded memory during the works pass
const MAX_BLURB_LENGTH = 1600;

const CHECKPOINT_DIR = join(__dirname, ".import-checkpoint");
const WORKS_CHECKPOINT_PATH = join(CHECKPOINT_DIR, "selected-works.json");
const OUTPUT_PATH = join(__dirname, "seed-data", "real-catalog.json");

// --- Streaming dump reader ---------------------------------------------

async function streamDumpLines(fileName: string, onLine: (line: string) => void): Promise<void> {
  const url = `${DUMP_BASE}/${fileName}`;
  console.log(`Fetching ${url} ...`);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);

  const nodeStream = Readable.fromWeb(res.body as never);
  const gunzip = createGunzip();
  const rl = createInterface({ input: nodeStream.pipe(gunzip), crlfDelay: Infinity });

  // Smoke-test hook: SMOKE_TEST_MAX_LINES=N truncates every dump stream to
  // its first N lines, so the whole pipeline can be exercised end-to-end in
  // seconds instead of an hour+. Truncating all four dumps independently
  // means the final assembled book count will be ~0 (the dumps aren't in a
  // correlated order, so a given work's author/edition record is unlikely
  // to also fall within the same early prefix) — that's expected, not a
  // bug; it's the per-pass counts (genre buckets, names/editions resolved)
  // that actually validate the logic. No-op (Infinity) when unset.
  const smokeTestMax = process.env.SMOKE_TEST_MAX_LINES ? parseInt(process.env.SMOKE_TEST_MAX_LINES, 10) : Infinity;
  let count = 0;
  for await (const line of rl) {
    onLine(line);
    count++;
    if (count % 500_000 === 0) console.log(`  ${fileName}: ${count.toLocaleString()} lines`);
    if (count >= smokeTestMax) {
      rl.close();
      gunzip.destroy();
      nodeStream.destroy();
      break;
    }
  }
  console.log(`Done with ${fileName}: ${count.toLocaleString()} lines total.`);
}

function parseDumpRecord(line: string): { type: string; key: string; json: Record<string, unknown> } | null {
  const cols = line.split("\t");
  if (cols.length < 5) return null;
  try {
    return { type: cols[0], key: cols[1], json: JSON.parse(cols[4]) };
  } catch {
    return null;
  }
}

// --- Genre inference from Open Library's free-text subjects -------------

// Best-effort, hand-authored — Open Library's subject headings are messy
// library-cataloging phrases, not our vocabulary. Romantasy/Cozy Mystery
// are special-cased below since they rarely appear as their own subject
// heading; everything else is a first-match-wins scan.
const GENRE_KEYWORDS: Record<string, string[]> = {
  Romance: ["love stories", "romance fiction", "man-woman relationships"],
  Fantasy: ["fantasy fiction", "fantasy", "magic fiction", "wizards", "dragons", "imaginary wars and battles"],
  "Sci-Fi": ["science fiction", "space opera", "life on other planets"],
  Mystery: ["detective and mystery stories", "mystery fiction", "mystery and detective stories", "whodunit"],
  Thriller: ["suspense fiction", "thrillers (fiction)", "thriller", "spy stories"],
  "Literary Fiction": ["literary fiction", "psychological fiction", "domestic fiction"],
  Horror: ["horror fiction", "horror stories", "horror tales", "ghost stories", "occult fiction"],
  Contemporary: ["contemporary fiction", "chick lit"],
  "Historical Fiction": ["historical fiction"],
  "Young Adult": ["young adult fiction", "juvenile fiction"],
};
const COZY_MYSTERY_KEYWORDS = ["cozy mystery", "cozy mysteries"];

function detectGenre(subjects: string[]): string | null {
  const lower = subjects.map((s) => s.toLowerCase());
  const hasAny = (keywords: string[]) => keywords.some((kw) => lower.some((s) => s.includes(kw)));

  const isFantasy = hasAny(GENRE_KEYWORDS.Fantasy);
  const isRomance = hasAny(GENRE_KEYWORDS.Romance);
  if (isFantasy && isRomance) return "Romantasy";
  if (hasAny(COZY_MYSTERY_KEYWORDS)) return "Cozy Mystery";

  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (hasAny(keywords)) return genre;
  }
  return null;
}

function extractDescription(raw: unknown): string | null {
  if (typeof raw === "string") return raw.trim() || null;
  if (raw && typeof raw === "object" && "value" in raw) {
    const value = (raw as { value?: unknown }).value;
    return typeof value === "string" ? value.trim() || null : null;
  }
  return null;
}

function deriveHookLine(description: string): string {
  const firstSentence = description.split(/(?<=[.!?])\s+/)[0] ?? description;
  return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}...` : firstSentence;
}

// --- Types for the intermediate checkpoint -------------------------------

type SelectedWork = {
  key: string;
  title: string;
  authorKeys: string[];
  description: string;
  subjects: string[];
  genre: string;
  popularity: number;
};

type RealCatalogBook = {
  title: string;
  author: string;
  hookLine: string;
  blurb: string;
  compTitle: null;
  coverUrl: string;
  heatLevel: "none";
  pacing: "medium";
  pageCount: number;
  publishedYear: number;
  genre: string;
  tropes: string[];
  moods: string[];
  contentWarnings: never[];
  needsReview: true;
};

// --- Pass 1: popularity (ratings dump) -----------------------------------

async function buildPopularityMap(): Promise<Map<string, number>> {
  console.log("\n=== Pass 1: popularity (ratings dump) ===");
  const counts = new Map<string, number>();
  await streamDumpLines("ol_dump_ratings_latest.txt.gz", (line) => {
    const [workKey] = line.split("\t");
    if (!workKey) return;
    counts.set(workKey, (counts.get(workKey) ?? 0) + 1);
  });
  console.log(`Popularity map built for ${counts.size.toLocaleString()} works.`);
  return counts;
}

// --- Pass 2: genre-bucketed work selection (works dump) ------------------

async function selectWorks(popularity: Map<string, number>): Promise<SelectedWork[]> {
  console.log("\n=== Pass 2: genre-bucketed selection (works dump) ===");
  const buckets = new Map<string, SelectedWork[]>();

  function compactBucket(genre: string) {
    const bucket = buckets.get(genre);
    if (!bucket || bucket.length <= CANDIDATE_CAP_PER_GENRE) return;
    bucket.sort((a, b) => b.popularity - a.popularity);
    bucket.length = Math.min(bucket.length, Math.ceil(CANDIDATE_CAP_PER_GENRE / 2));
  }

  await streamDumpLines("ol_dump_works_latest.txt.gz", (line) => {
    const record = parseDumpRecord(line);
    if (!record || record.type !== "/type/work") return;
    const json = record.json as {
      title?: string;
      subjects?: string[];
      description?: unknown;
      authors?: { author?: { key?: string } }[];
    };
    if (!json.title || !json.subjects?.length) return;

    const description = extractDescription(json.description);
    if (!description || description.length < 40) return;

    const genre = detectGenre(json.subjects);
    if (!genre) return;

    const authorKeys = (json.authors ?? [])
      .map((a) => a.author?.key)
      .filter((k): k is string => Boolean(k));
    if (authorKeys.length === 0) return;

    const entry: SelectedWork = {
      key: record.key,
      title: json.title,
      authorKeys,
      description,
      subjects: json.subjects,
      genre,
      popularity: popularity.get(record.key) ?? 0,
    };

    const bucket = buckets.get(genre) ?? [];
    bucket.push(entry);
    buckets.set(genre, bucket);
    if (bucket.length > CANDIDATE_CAP_PER_GENRE) compactBucket(genre);
  });

  const selected: SelectedWork[] = [];
  for (const [genre, bucket] of buckets) {
    bucket.sort((a, b) => b.popularity - a.popularity);
    const top = bucket.slice(0, TARGET_PER_GENRE);
    console.log(`  ${genre}: ${top.length} selected (of ${bucket.length} candidates seen)`);
    selected.push(...top);
  }
  return selected;
}

// --- Pass 3: resolve author names (authors dump) -------------------------

async function resolveAuthorNames(works: SelectedWork[]): Promise<Map<string, string>> {
  console.log("\n=== Pass 3: author name resolution (authors dump) ===");
  const neededKeys = new Set(works.flatMap((w) => w.authorKeys));
  console.log(`Need names for ${neededKeys.size.toLocaleString()} distinct authors.`);

  const names = new Map<string, string>();
  await streamDumpLines("ol_dump_authors_latest.txt.gz", (line) => {
    if (names.size >= neededKeys.size) return; // early-exit cheaply once satisfied
    const record = parseDumpRecord(line);
    if (!record || record.type !== "/type/author") return;
    if (!neededKeys.has(record.key)) return;
    const name = (record.json as { name?: string }).name;
    if (name) names.set(record.key, name);
  });
  console.log(`Resolved ${names.size.toLocaleString()} / ${neededKeys.size.toLocaleString()} author names.`);
  return names;
}

// --- Pass 4: edition enrichment (editions dump) ---------------------------

type EditionInfo = { isbn: string; coverId: number; pageCount: number; publishedYear: number };

async function enrichWithEditions(workKeys: Set<string>): Promise<Map<string, EditionInfo>> {
  console.log("\n=== Pass 4: edition enrichment (editions dump) ===");
  const found = new Map<string, EditionInfo>();

  await streamDumpLines("ol_dump_editions_latest.txt.gz", (line) => {
    if (found.size >= workKeys.size) return;
    const record = parseDumpRecord(line);
    if (!record || record.type !== "/type/edition") return;

    const json = record.json as {
      works?: { key?: string }[];
      isbn_13?: string[];
      isbn_10?: string[];
      covers?: number[];
      number_of_pages?: number;
      publish_date?: string;
      languages?: { key?: string }[];
    };
    const workKey = json.works?.[0]?.key;
    if (!workKey || !workKeys.has(workKey) || found.has(workKey)) return;

    const isbn = json.isbn_13?.[0] ?? json.isbn_10?.[0];
    const coverId = json.covers?.[0];
    if (!isbn || !coverId || coverId <= 0) return;

    const isEnglish = !json.languages || json.languages.some((l) => l.key === "/languages/eng");
    if (!isEnglish) return;

    const yearMatch = json.publish_date?.match(/\d{4}/);
    const publishedYear = yearMatch ? parseInt(yearMatch[0], 10) : 2000;
    const pageCount = json.number_of_pages && json.number_of_pages > 0 ? json.number_of_pages : 320;

    found.set(workKey, { isbn, coverId, pageCount, publishedYear });
  });
  console.log(`Found editions for ${found.size.toLocaleString()} / ${workKeys.size.toLocaleString()} works.`);
  return found;
}

// --- Tag inference (in-memory) --------------------------------------------

async function loadExistingVocab(): Promise<{ tropes: string[]; moods: string[] }> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const tags = await prisma.tag.findMany({ where: { category: { in: [TagCategory.trope, TagCategory.mood] } } });
    return {
      tropes: tags.filter((t) => t.category === TagCategory.trope).map((t) => t.label),
      moods: tags.filter((t) => t.category === TagCategory.mood).map((t) => t.label),
    };
  } finally {
    await prisma.$disconnect();
  }
}

function matchVocab(subjects: string[], vocab: string[]): string[] {
  const lowerSubjects = subjects.map((s) => s.toLowerCase());
  const matched = vocab.filter((label) => lowerSubjects.some((s) => s.includes(label.toLowerCase())));
  return [...new Set(matched)];
}

// --- Main ------------------------------------------------------------------

async function main() {
  mkdirSync(CHECKPOINT_DIR, { recursive: true });

  let selectedWorks: SelectedWork[];
  if (existsSync(WORKS_CHECKPOINT_PATH)) {
    console.log(`Resuming from checkpoint: ${WORKS_CHECKPOINT_PATH}`);
    selectedWorks = JSON.parse(readFileSync(WORKS_CHECKPOINT_PATH, "utf-8"));
  } else {
    const popularity = await buildPopularityMap();
    selectedWorks = await selectWorks(popularity);
    writeFileSync(WORKS_CHECKPOINT_PATH, JSON.stringify(selectedWorks));
    console.log(`Checkpointed ${selectedWorks.length} selected works to ${WORKS_CHECKPOINT_PATH}`);
  }

  const authorNames = await resolveAuthorNames(selectedWorks);
  const workKeys = new Set(selectedWorks.map((w) => w.key));
  const editions = await enrichWithEditions(workKeys);

  console.log("\n=== Pass 5: tag inference + assembly ===");
  const vocab = await loadExistingVocab();

  const books: RealCatalogBook[] = [];
  for (const work of selectedWorks) {
    const edition = editions.get(work.key);
    if (!edition) continue; // no usable edition found — drop rather than guess

    const author = work.authorKeys.map((k) => authorNames.get(k)).find(Boolean);
    if (!author) continue;

    const blurb =
      work.description.length > MAX_BLURB_LENGTH
        ? `${work.description.slice(0, MAX_BLURB_LENGTH)}...`
        : work.description;

    books.push({
      title: work.title,
      author,
      hookLine: deriveHookLine(work.description),
      blurb,
      compTitle: null,
      coverUrl: `https://covers.openlibrary.org/b/id/${edition.coverId}-L.jpg`,
      heatLevel: "none",
      pacing: "medium",
      pageCount: edition.pageCount,
      publishedYear: edition.publishedYear,
      genre: work.genre,
      tropes: matchVocab(work.subjects, vocab.tropes),
      moods: matchVocab(work.subjects, vocab.moods),
      contentWarnings: [],
      needsReview: true,
    });
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(books, null, 2));
  console.log(`\nWrote ${books.length} books to ${OUTPUT_PATH}`);

  const genreCounts: Record<string, number> = {};
  for (const b of books) genreCounts[b.genre] = (genreCounts[b.genre] ?? 0) + 1;
  console.log("Genre breakdown:", genreCounts);
  const withTrope = books.filter((b) => b.tropes.length > 0).length;
  const withMood = books.filter((b) => b.moods.length > 0).length;
  console.log(`Books with >=1 trope tag: ${withTrope} / ${books.length}`);
  console.log(`Books with >=1 mood tag: ${withMood} / ${books.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
