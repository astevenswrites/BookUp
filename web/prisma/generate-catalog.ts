// Generates the synthetic placeholder catalog ONCE into a committed fixture
// (prisma/seed-data/catalog.json + public/covers/*.svg). Run manually when you
// want to regenerate or expand the placeholder set — NOT run automatically.
//
// This is deliberately separate from seed.ts (which just loads the fixture into
// a database). See DECISIONS.md D19 for why: generation must be deterministic
// and shared across environments, or local/production catalogs drift apart and
// cover files stop matching database rows. Never write directly to a database
// from this file.

import { faker } from "@faker-js/faker";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BOOK_COUNT = 350;
const COVERS_DIR = join(__dirname, "..", "public", "covers");
const FIXTURE_PATH = join(__dirname, "seed-data", "catalog.json");

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

// Trope pools are genre-scoped (D44) — picking tropes from one global list
// meant every genre's books got romance tropes ("only one bed" on a horror
// novel), which both looked wrong and starved non-romance genres of any
// tropes a reader could actually recognize their taste in. A handful of
// tropes genuinely span genres (found family, chosen one, etc.) and are
// listed in more than one pool deliberately, not merged into one "universal"
// bucket — most tropes here are still genre-specific on purpose.
const GENRE_TROPES: Record<string, string[]> = {
  Romance: [
    "enemies-to-lovers",
    "forced proximity",
    "grumpy/sunshine",
    "second chance",
    "fake dating",
    "only one bed",
    "love triangle",
    "instalove",
    "friends-to-lovers",
    "workplace romance",
    "small town",
  ],
  Romantasy: [
    "enemies-to-lovers",
    "forced proximity",
    "fated mates",
    "chosen one",
    "royal intrigue",
    "morally grey protagonist",
    "found family",
    "prophecy",
    "grumpy/sunshine",
    "second chance",
  ],
  Fantasy: [
    "chosen one",
    "found family",
    "mentor and student",
    "magic school",
    "epic quest",
    "prophecy",
    "portal fantasy",
    "hidden royal heritage",
    "ancient evil awakens",
    "morally grey protagonist",
    "royal intrigue",
    "band of misfits",
  ],
  "Sci-Fi": [
    "first contact",
    "ai uprising",
    "generation ship",
    "time loop",
    "dystopian rebellion",
    "space opera politics",
    "clone/identity crisis",
    "hard science puzzle",
    "found family",
    "morally grey protagonist",
    "last human on earth",
  ],
  Horror: [
    "haunted house",
    "final girl",
    "unreliable narrator",
    "body horror",
    "cosmic horror",
    "cursed object",
    "isolated setting",
    "slow-burn dread",
    "possession",
    "small town",
  ],
  Mystery: [
    "whodunit",
    "locked room",
    "amateur sleuth",
    "cold case",
    "unreliable narrator",
    "twist ending",
    "secret identity",
    "small town",
  ],
  Thriller: [
    "cat and mouse",
    "twist ending",
    "revenge",
    "unreliable narrator",
    "conspiracy",
    "race against time",
    "secret identity",
    "morally grey protagonist",
  ],
  "Literary Fiction": [
    "coming of age",
    "multigenerational saga",
    "quiet devastation",
    "unreliable narrator",
    "redemption arc",
    "small town",
  ],
  Contemporary: [
    "found family",
    "small town",
    "coming of age",
    "second chance",
    "workplace drama",
    "friends-to-lovers",
    "road trip",
  ],
  "Historical Fiction": [
    "dual timeline",
    "based on true events",
    "war-era setting",
    "forbidden love",
    "royal intrigue",
    "found family",
  ],
  "Young Adult": [
    "coming of age",
    "found family",
    "first love",
    "chosen one",
    "friend-group dynamics",
    "secret identity",
    "road trip",
  ],
  "Cozy Mystery": [
    "amateur sleuth",
    "small town",
    "found family",
    "whodunit",
    "quirky ensemble cast",
    "secret identity",
  ],
};

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
  "eerie",
  "epic",
  "wondrous",
  "gritty",
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

const HEAT_LEVELS = ["none", "low", "medium", "high"] as const;
const PACINGS = ["slow_burn", "medium", "fast_paced"] as const;

export type CatalogBook = {
  title: string;
  author: string;
  hookLine: string;
  blurb: string;
  compTitle: string | null;
  coverUrl: string;
  heatLevel: (typeof HEAT_LEVELS)[number];
  pacing: (typeof PACINGS)[number];
  pageCount: number;
  publishedYear: number;
  genre: string;
  tropes: string[];
  moods: string[];
  contentWarnings: string[];
};

function pick<T>(arr: T[], n: number): T[] {
  return faker.helpers.arrayElements(arr, n);
}

function pickOne<T>(arr: readonly T[]): T {
  return faker.helpers.arrayElement(arr as T[]);
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

function writeMissingCoverAsset() {
  writeFileSync(
    join(COVERS_DIR, "missing.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <rect width="400" height="600" fill="#d9d9d9" />
  <text x="200" y="290" font-family="sans-serif" font-size="20" fill="#666" text-anchor="middle">No Cover</text>
  <text x="200" y="320" font-family="sans-serif" font-size="20" fill="#666" text-anchor="middle">Available</text>
</svg>`
  );
}

function main() {
  mkdirSync(COVERS_DIR, { recursive: true });
  mkdirSync(join(__dirname, "seed-data"), { recursive: true });

  // Every previous run's cover files are orphaned the moment catalog.json is
  // overwritten (new random filenames each time) — clear them first so
  // re-running this script doesn't silently double the tracked SVG count.
  for (const f of readdirSync(COVERS_DIR)) {
    if (f.endsWith(".svg")) rmSync(join(COVERS_DIR, f));
  }

  writeMissingCoverAsset();

  const books: CatalogBook[] = [];

  console.log(`Generating ${BOOK_COUNT} placeholder books...`);
  for (let i = 0; i < BOOK_COUNT; i++) {
    const genre = pickOne(GENRES);
    const tropePool = GENRE_TROPES[genre];
    const tropes = pick(tropePool, Math.min(tropePool.length, faker.number.int({ min: 1, max: 3 })));
    const moods = pick(MOODS, faker.number.int({ min: 1, max: 3 }));
    // ~40% of books have zero content warnings, matching real-world tagging gaps
    const contentWarnings =
      faker.number.int({ min: 0, max: 9 }) < 4
        ? []
        : pick(CONTENT_WARNINGS, faker.number.int({ min: 1, max: 2 }));

    const title = generateTitle();
    const author = faker.person.fullName();

    // ~10% of books deliberately lack real cover art (mirrors a real, incomplete catalog)
    const hasCover = faker.number.int({ min: 0, max: 9 }) !== 0;
    let coverUrl = "/covers/missing.svg";
    if (hasCover) {
      const svg = generateCoverSvg(title, author);
      const fileName = `${faker.string.alphanumeric(12)}.svg`;
      writeFileSync(join(COVERS_DIR, fileName), svg);
      coverUrl = `/covers/${fileName}`;
    }

    books.push({
      title,
      author,
      hookLine: generateHookLine(tropes[0], moods[0]),
      blurb: generateBlurb(),
      compTitle: faker.datatype.boolean({ probability: 0.6 })
        ? `If you loved ${generateTitle()}, swipe right.`
        : null,
      coverUrl,
      heatLevel: pickOne(HEAT_LEVELS),
      pacing: pickOne(PACINGS),
      pageCount: faker.number.int({ min: 140, max: 720 }),
      publishedYear: faker.number.int({ min: 1985, max: 2026 }),
      genre,
      tropes,
      moods,
      contentWarnings,
    });

    if ((i + 1) % 50 === 0 || i + 1 === BOOK_COUNT) {
      console.log(`  ${i + 1} / ${BOOK_COUNT}`);
    }
  }

  writeFileSync(FIXTURE_PATH, JSON.stringify(books, null, 2));
  console.log(`Wrote fixture to ${FIXTURE_PATH}`);
}

main();
