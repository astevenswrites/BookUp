// Synthetic placeholder catalog generator (see DECISIONS.md D6, ROADMAP.md "Real catalog sourcing").
// Deliberately messy: variable blurb length, some books missing real cover art, tag counts vary
// per book — so the swipe-card UI gets designed against realistic mess, not clean fixtures.

import "dotenv/config";
import { faker } from "@faker-js/faker";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PrismaClient,
  HeatLevel,
  Pacing,
  TagCategory,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BOOK_COUNT = 350;
const COVERS_DIR = join(__dirname, "..", "public", "covers");

const GENRES = [
  "Romance",
  "Fantasy",
  "Sci-Fi",
  "Mystery",
  "Thriller",
  "Literary Fiction",
  "Horror",
  "Contemporary",
  "Historical Fiction",
  "Young Adult",
  "Cozy Mystery",
  "Romantasy",
];

const TROPES = [
  "enemies-to-lovers",
  "found family",
  "forced proximity",
  "grumpy/sunshine",
  "second chance",
  "chosen one",
  "fake dating",
  "morally grey protagonist",
  "only one bed",
  "secret identity",
  "road trip",
  "mentor and student",
  "revenge",
  "redemption arc",
  "love triangle",
  "instalove",
  "friends-to-lovers",
  "royal intrigue",
  "small town",
  "workplace romance",
];

const MOODS = [
  "cozy",
  "dark",
  "bittersweet",
  "hopeful",
  "devastating",
  "funny",
  "atmospheric",
  "whimsical",
  "tense",
  "melancholy",
  "heartwarming",
  "unsettling",
];

const CONTENT_WARNINGS = [
  "sexual assault",
  "graphic violence",
  "death of a parent",
  "self-harm",
  "substance abuse",
  "animal death",
  "domestic abuse",
  "suicide",
  "eating disorder",
  "on-page death",
];

const COVER_PALETTES = [
  ["#2b1b3d", "#f4c95d"],
  ["#0f3057", "#e5e5e5"],
  ["#3a0ca3", "#f72585"],
  ["#1b4332", "#d8f3dc"],
  ["#7f1d1d", "#fde68a"],
  ["#14213d", "#fca311"],
  ["#4a4e69", "#f2e9e4"],
  ["#283618", "#fefae0"],
  ["#5e0b15", "#e2c2b9"],
  ["#22223b", "#c9ada7"],
];

function pick<T>(arr: T[], n: number): T[] {
  return faker.helpers.arrayElements(arr, n);
}

function pickOne<T>(arr: T[]): T {
  return faker.helpers.arrayElement(arr);
}

function titleCaseWord(w: string) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function generateTitle(): string {
  const adj = () => titleCaseWord(faker.word.adjective());
  const noun = () => titleCaseWord(faker.word.noun());
  const name = () => faker.person.firstName();

  const patterns = [
    () => `The ${adj()} ${noun()}`,
    () => `${noun()} of ${noun()}`,
    () => `A ${adj()} ${noun()}`,
    () => `${name()}'s ${noun()}`,
    () => `${noun()} and ${noun()}`,
    () => `The Last ${noun()}`,
    () => `${adj()} ${noun()}`,
    () => `The ${noun()} We ${faker.word.verb()}`,
  ];
  return pickOne(patterns)();
}

const HOOK_LINE_TEMPLATES = [
  (t: string, m: string) => `A ${m} ${t} story that sneaks up on you.`,
  (t: string, m: string) => `${titleCaseWord(m)}, ${t}, and a twist you won't see coming.`,
  (t: string, m: string) => `This ${m} ${t} tale will wreck you in the best way.`,
  (t: string, m: string) => `Equal parts ${m} and unforgettable.`,
  (t: string, m: string) => `For readers who want ${t} with a ${m} edge.`,
];

function generateHookLine(trope: string, mood: string): string {
  return pickOne(HOOK_LINE_TEMPLATES)(trope, mood);
}

function generateBlurb(): string {
  // Full synopsis for the tap-to-expand detail view — deliberately variable length
  // so the UI isn't designed around uniformly-sized text (see DECISIONS.md D14).
  const sentenceCount = faker.number.int({ min: 2, max: 6 });
  return faker.lorem.paragraph({ min: 2, max: sentenceCount });
}

function wrapSvgText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxCharsPerLine) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function generateCoverSvg(title: string, author: string): string {
  const [bg, fg] = pickOne(COVER_PALETTES);
  const titleLines = wrapSvgText(title, 16);
  const titleTspans = titleLines
    .map((line, i) => `<tspan x="30" dy="${i === 0 ? 0 : 34}">${escapeXml(line)}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <rect width="400" height="600" fill="${bg}" />
  <rect x="20" y="20" width="360" height="560" fill="none" stroke="${fg}" stroke-width="2" opacity="0.5" />
  <text x="30" y="220" font-family="Georgia, serif" font-size="28" fill="${fg}" font-weight="bold">${titleTspans}</text>
  <text x="30" y="560" font-family="Georgia, serif" font-size="16" fill="${fg}" opacity="0.85">${escapeXml(author)}</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensureMissingCoverAsset() {
  const path = join(COVERS_DIR, "missing.svg");
  if (!existsSync(path)) {
    writeFileSync(
      path,
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <rect width="400" height="600" fill="#d9d9d9" />
  <text x="200" y="290" font-family="sans-serif" font-size="20" fill="#666" text-anchor="middle">No Cover</text>
  <text x="200" y="320" font-family="sans-serif" font-size="20" fill="#666" text-anchor="middle">Available</text>
</svg>`
    );
  }
}

async function main() {
  mkdirSync(COVERS_DIR, { recursive: true });
  ensureMissingCoverAsset();

  console.log("Seeding tags...");
  const tagDefs: { label: string; category: TagCategory }[] = [
    ...GENRES.map((label) => ({ label, category: TagCategory.genre })),
    ...TROPES.map((label) => ({ label, category: TagCategory.trope })),
    ...MOODS.map((label) => ({ label, category: TagCategory.mood })),
    ...CONTENT_WARNINGS.map((label) => ({
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

  console.log(`Seeding ${BOOK_COUNT} placeholder books...`);
  for (let i = 0; i < BOOK_COUNT; i++) {
    const genre = pickOne(GENRES);
    const bookTropes = pick(TROPES, faker.number.int({ min: 1, max: 3 }));
    const bookMoods = pick(MOODS, faker.number.int({ min: 1, max: 3 }));
    // ~40% of books have zero content warnings, matching real-world tagging gaps
    const bookWarnings =
      faker.number.int({ min: 0, max: 9 }) < 4
        ? []
        : pick(CONTENT_WARNINGS, faker.number.int({ min: 1, max: 2 }));

    const title = generateTitle();
    const author = faker.person.fullName();
    const primaryTrope = bookTropes[0];
    const primaryMood = bookMoods[0];

    // ~10% of books deliberately lack real cover art (mirrors a real, incomplete catalog)
    const hasCover = faker.number.int({ min: 0, max: 9 }) !== 0;
    let coverUrl = "/covers/missing.svg";
    if (hasCover) {
      const svg = generateCoverSvg(title, author);
      const fileName = `${faker.string.alphanumeric(12)}.svg`;
      writeFileSync(join(COVERS_DIR, fileName), svg);
      coverUrl = `/covers/${fileName}`;
    }

    const allTagKeys = [
      { category: TagCategory.genre, label: genre },
      ...bookTropes.map((t) => ({ category: TagCategory.trope, label: t })),
      ...bookMoods.map((m) => ({ category: TagCategory.mood, label: m })),
      ...bookWarnings.map((w) => ({
        category: TagCategory.content_warning,
        label: w,
      })),
    ];

    await prisma.book.create({
      data: {
        title,
        author,
        hookLine: generateHookLine(primaryTrope, primaryMood),
        blurb: generateBlurb(),
        compTitle:
          faker.datatype.boolean({ probability: 0.6 })
            ? `If you loved ${generateTitle()}, swipe right.`
            : null,
        coverUrl,
        heatLevel: pickOne(Object.values(HeatLevel)),
        pacing: pickOne(Object.values(Pacing)),
        pageCount: faker.number.int({ min: 140, max: 720 }),
        publishedYear: faker.number.int({ min: 1985, max: 2026 }),
        tags: {
          create: allTagKeys.map(({ category, label }) => ({
            tag: { connect: { id: tagIdByKey.get(`${category}:${label}`)! } },
          })),
        },
      },
    });
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
