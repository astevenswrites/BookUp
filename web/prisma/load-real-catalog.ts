// Loads prisma/seed-data/real-catalog.json (D66, produced by
// import-open-library.ts) into whichever database DATABASE_URL points at.
//
//   npx tsx prisma/load-real-catalog.ts
//
// Unlike seed.ts, this is ADDITIVE-ONLY — no deleteMany, ever. seed.ts wipes
// the whole Book table on every run, which DECISIONS.md D19 already flags
// as unsafe against production once real swipe/shelf history exists; this
// script must never gain that behavior. Safe to re-run: skips any book
// whose title+author already exists, so re-running after a partial failure
// (or after adding more entries to the fixture) doesn't duplicate rows.

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, HeatLevel, Pacing, TagCategory } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const FIXTURE_PATH = join(__dirname, "seed-data", "real-catalog.json");
const BATCH_SIZE = 2000; // matches seed.ts — see DECISIONS.md D20

type RealCatalogBook = {
  title: string;
  author: string;
  hookLine: string;
  blurb: string;
  compTitle: string | null;
  coverUrl: string;
  heatLevel: keyof typeof HeatLevel;
  pacing: keyof typeof Pacing;
  pageCount: number;
  publishedYear: number;
  genre: string;
  tropes: string[];
  moods: string[];
  contentWarnings: string[];
  needsReview: boolean;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const allBooks: RealCatalogBook[] = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));

  console.log("Checking for already-loaded books...");
  const existing = await prisma.book.findMany({ select: { title: true, author: true } });
  const existingKeys = new Set(existing.map((b) => `${b.title}::${b.author}`));
  const books = allBooks.filter((b) => !existingKeys.has(`${b.title}::${b.author}`));
  console.log(`${allBooks.length} in fixture, ${books.length} new (${allBooks.length - books.length} already loaded).`);
  if (books.length === 0) return;

  console.log("Loading tags...");
  const genres = new Set<string>();
  const tropes = new Set<string>();
  const moods = new Set<string>();
  for (const book of books) {
    genres.add(book.genre);
    book.tropes.forEach((t) => tropes.add(t));
    book.moods.forEach((m) => moods.add(m));
  }

  const tagDefs: { label: string; category: TagCategory }[] = [
    ...[...genres].map((label) => ({ label, category: TagCategory.genre })),
    ...[...tropes].map((label) => ({ label, category: TagCategory.trope })),
    ...[...moods].map((label) => ({ label, category: TagCategory.mood })),
  ];
  await prisma.tag.createMany({ data: tagDefs, skipDuplicates: true });
  const allTags = await prisma.tag.findMany();
  const tagIdByKey = new Map(allTags.map((t) => [`${t.category}:${t.label}`, t.id]));

  console.log(`Loading ${books.length} real books...`);
  const bookIds = books.map(() => randomUUID());
  const bookRows = books.map((book, i) => ({
    id: bookIds[i],
    title: book.title,
    author: book.author,
    hookLine: book.hookLine,
    blurb: book.blurb,
    compTitle: book.compTitle,
    coverUrl: book.coverUrl,
    heatLevel: HeatLevel[book.heatLevel],
    pacing: Pacing[book.pacing],
    pageCount: book.pageCount,
    publishedYear: book.publishedYear,
    needsReview: book.needsReview,
  }));

  for (const [i, batch] of chunk(bookRows, BATCH_SIZE).entries()) {
    await prisma.book.createMany({ data: batch });
    console.log(`  books: batch ${i + 1}`);
  }

  const bookTagRows: { bookId: string; tagId: string }[] = [];
  books.forEach((book, i) => {
    const keys = [
      { category: TagCategory.genre, label: book.genre },
      ...book.tropes.map((t) => ({ category: TagCategory.trope, label: t })),
      ...book.moods.map((m) => ({ category: TagCategory.mood, label: m })),
    ];
    for (const { category, label } of keys) {
      const tagId = tagIdByKey.get(`${category}:${label}`);
      if (tagId) bookTagRows.push({ bookId: bookIds[i], tagId });
    }
  });

  for (const [i, batch] of chunk(bookTagRows, BATCH_SIZE).entries()) {
    await prisma.bookTag.createMany({ data: batch });
    console.log(`  tag associations: batch ${i + 1}`);
  }

  console.log(`Done. Loaded ${bookRows.length} books, ${bookTagRows.length} tag associations.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
