// Loads the committed placeholder catalog fixture (prisma/seed-data/catalog.json)
// into whichever database DATABASE_URL points at. Deterministic — the same
// fixture (and matching public/covers/*.svg files) is used in every environment.
// See DECISIONS.md D19 for why this is split from prisma/generate-catalog.ts,
// and its "accepted tradeoff" note on why clearing Book rows here is safe only
// before Phase 1 ships real anonymous swipe data.

import "dotenv/config";
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

  const tagIdByKey = new Map<string, string>();
  for (const def of tagDefs) {
    const tag = await prisma.tag.upsert({
      where: { label_category: { label: def.label, category: def.category } },
      update: {},
      create: def,
    });
    tagIdByKey.set(`${def.category}:${def.label}`, tag.id);
  }

  console.log(`Loading ${books.length} placeholder books...`);
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const allTagKeys = [
      { category: TagCategory.genre, label: book.genre },
      ...book.tropes.map((t) => ({ category: TagCategory.trope, label: t })),
      ...book.moods.map((m) => ({ category: TagCategory.mood, label: m })),
      ...book.contentWarnings.map((w) => ({
        category: TagCategory.content_warning,
        label: w,
      })),
    ];

    await prisma.book.create({
      data: {
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
        tags: {
          create: allTagKeys.map(({ category, label }) => ({
            tag: { connect: { id: tagIdByKey.get(`${category}:${label}`)! } },
          })),
        },
      },
    });

    if ((i + 1) % 25 === 0 || i + 1 === books.length) {
      const pct = (((i + 1) / books.length) * 100).toFixed(0);
      console.log(`  ${i + 1} / ${books.length} (${pct}%)`);
    }
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
