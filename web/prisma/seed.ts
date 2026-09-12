// Loads the committed placeholder catalog fixture (prisma/seed-data/catalog.json)
// into whichever database DATABASE_URL points at. Deterministic — the same
// fixture (and matching public/covers/*.svg files) is used in every environment.
// See DECISIONS.md D19 for why this is split from prisma/generate-catalog.ts,
// and D20 for why loading is batched — this is the pattern the eventual real
// catalog importer should follow too, not the per-row loop it replaced.

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PrismaClient,
  HeatLevel,
  Pacing,
  TagCategory,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { CatalogBook } from "./generate-catalog";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const FIXTURE_PATH = join(__dirname, "seed-data", "catalog.json");

// Stays well under Postgres's ~65535 bound-parameter limit per statement even
// for the widest table here (Book, ~11 columns) — see DECISIONS.md D20.
const BATCH_SIZE = 2000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const books: CatalogBook[] = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));

  console.log("Clearing existing placeholder books...");
  await prisma.book.deleteMany({});

  console.log("Loading tags...");
  const genres = new Set<string>();
  const tropes = new Set<string>();
  const moods = new Set<string>();
  const contentWarnings = new Set<string>();
  for (const book of books) {
    genres.add(book.genre);
    book.tropes.forEach((t) => tropes.add(t));
    book.moods.forEach((m) => moods.add(m));
    book.contentWarnings.forEach((w) => contentWarnings.add(w));
  }

  const tagDefs: { label: string; category: TagCategory }[] = [
    ...[...genres].map((label) => ({ label, category: TagCategory.genre })),
    ...[...tropes].map((label) => ({ label, category: TagCategory.trope })),
    ...[...moods].map((label) => ({ label, category: TagCategory.mood })),
    ...[...contentWarnings].map((label) => ({
      label,
      category: TagCategory.content_warning,
    })),
  ];

  await prisma.tag.createMany({ data: tagDefs, skipDuplicates: true });
  const allTags = await prisma.tag.findMany();
  const tagIdByKey = new Map(allTags.map((t) => [`${t.category}:${t.label}`, t.id]));

  console.log(`Loading ${books.length} placeholder books...`);

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
  }));

  const bookBatches = chunk(bookRows, BATCH_SIZE);
  for (let b = 0; b < bookBatches.length; b++) {
    await prisma.book.createMany({ data: bookBatches[b] });
    console.log(`  books: batch ${b + 1} / ${bookBatches.length}`);
  }

  const bookTagRows: { bookId: string; tagId: string }[] = [];
  books.forEach((book, i) => {
    const keys = [
      { category: TagCategory.genre, label: book.genre },
      ...book.tropes.map((t) => ({ category: TagCategory.trope, label: t })),
      ...book.moods.map((m) => ({ category: TagCategory.mood, label: m })),
      ...book.contentWarnings.map((w) => ({
        category: TagCategory.content_warning,
        label: w,
      })),
    ];
    for (const { category, label } of keys) {
      bookTagRows.push({ bookId: bookIds[i], tagId: tagIdByKey.get(`${category}:${label}`)! });
    }
  });

  const tagBatches = chunk(bookTagRows, BATCH_SIZE);
  for (let b = 0; b < tagBatches.length; b++) {
    await prisma.bookTag.createMany({ data: tagBatches[b] });
    console.log(`  tag associations: batch ${b + 1} / ${tagBatches.length}`);
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
