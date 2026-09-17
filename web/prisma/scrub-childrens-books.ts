// One-off cleanup pass (D71) — manual-run-only, never wired into any
// automated flow. Removes children's/middle-grade books that leaked into
// the real-book catalog because GENRE_KEYWORDS["Young Adult"] included the
// bare "juvenile fiction" subject — Open Library's crowd-sourced catalog
// applies that tag to essentially anything for a reader under 18, so it
// swept in picture books (Green Eggs and Ham, If You Give a Mouse a
// Cookie), early readers (Elephant & Piggie, Amelia Bedelia), and
// middle-grade series (Diary of a Wimpy Kid, Dog Man, Percy Jackson,
// Goosebumps) right alongside genuine YA (The Hate U Give, Speak, Looking
// for Alaska). BookUp is a book *dating* app aimed at adults; that
// audience doesn't belong here — genuine YA does, per the user's call.
//
//   npx tsx prisma/scrub-childrens-books.ts           # dry run, prints only
//   npx tsx prisma/scrub-childrens-books.ts --apply   # removes from the
//                                                        fixture AND the DB
//
// This list was built by hand, reading every "Young Adult"-genre title in
// the catalog (208 of them) plus a keyword sweep of every other genre for
// known children's franchises that landed elsewhere via an earlier keyword
// match (Goosebumps -> Horror, Percy Jackson -> Fantasy, Captain
// Underpants -> Sci-Fi, etc. — detectGenre checks genres in a fixed order
// and stops at the first hit, so a kids' book can land almost anywhere).
// Automated subject-keyword classification was tried first and rejected:
// Open Library's "Children's fiction" subject tag is noisy enough that it
// also appears on The Fault in Our Stars, The Hunger Games, and Twilight —
// there is no single field that reliably separates "for a 9-year-old" from
// "YA," so this is a hand-reviewed denylist, not a heuristic.

import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isLikelyChildrensBook } from "./import-open-library";
import { normalizeTitle } from "../src/lib/textNormalize";

const CATALOG_PATH = join(__dirname, "seed-data", "real-catalog.json");
const CHECKPOINT_PATH = join(__dirname, ".import-checkpoint", "selected-works.json");

// Case-insensitive substring match anywhere in the title — safe because
// none of these strings collide with any genuine adult/YA title in the
// catalog (verified by hand when this list was built).
const SERIES_SUBSTRING_MATCHES = [
  "diary of a wimpy kid",
  "dork diaries",
  "dear dork",
  "big nate",
  "dog man",
  "geronimo stilton",
  "thea stilton",
  "series of unfortunate events",
  "baby-sitters club",
  "baby-sitter's club",
  "elephant and piggie",
  "elephant & piggie",
  "amelia bedelia",
  "goosebumps",
  "percy jackson",
  "captain underpants",
  "boxcar children",
  "hardy boys",
  "magic tree house",
];

// Standalone titles (picture books, early readers, and middle-grade
// standalones/series-without-a-shared-prefix) not caught by the substrings
// above. Exact title match, case-insensitive.
const EXACT_TITLE_MATCHES = [
  // Wimpy Kid subtitles stored without the series prefix
  "Ugly Truth",
  "Third Wheel",
  "The Last Straw",
  "Hard Luck",
  "Double Down",
  "The Long Haul",
  "Diary of an Awesome Friendly Kid",
  // Middle-grade / children's classics and series standalones
  "Wonder",
  "Holes",
  "Stellaluna",
  "Hatchet",
  "Green Eggs and Ham",
  "Because of Winn-Dixie",
  "Don't Let the Pigeon Drive the Bus!",
  "Where the Red Fern Grows",
  "Where the Sidewalk Ends",
  "Runaway Ralph",
  "Winnie the Pooh",
  "Goodnight Moon",
  "Drama",
  "The Lorax",
  "Oh, the places you'll go!",
  "What was I scared of?",
  "Twits",
  "Are You My Mother?",
  "Roller Girl",
  "George's Marvellous Medicine",
  "The Tale of Peter Rabbit",
  "Madeline",
  "Mrs. Frisby and the Rats of NIMH",
  "My Side of the Mountain",
  "A Light in the Attic",
  "Maniac Magee",
  "Awkward",
  "Are You There, God? It's Me, Margaret.",
  "Jungle Book",
  "The jungle books",
  "Alexander and the terrible, horrible, no good, very bad day",
  "Danny, The Champion of the World",
  "The Mouse and the Motorcycle",
  "Chicka chicka boom boom",
  "The cheese burglar",
  "We Are in a Book! (Elephant & Piggie)",
  "Night Before Christmas",
  "Out of my mind",
  "The Pigeon Finds a Hot Dog!",
  "I Can Read with My Eyes Shut!",
  "The Brilliant World of Tom Gates",
  "The Railway Children",
  "The Incredible Journey",
  "Ramona Quimby, Age 8",
  "The Baby-Sitters Club",
  "The duckling gets a cookie!?",
  "If You Give a Mouse a Cookie",
  "The Hundred Dresses",
  "Sideways Stories from Wayside School",
  "Pippi Longstocking",
  "Hans Andersen's fairy tales",
  "The true story of the 3 little pigs",
  "Don't let the pigeon stay up late!",
  "Beezus and Ramona",
  "Tales of a Fourth Grade Nothing",
  "Miss Nelson is missing!",
  "Curious George",
  "There Is a Bird On Your Head!",
  "Dear Mr. Henshaw",
  "I Love My New Toy! (Elephant and Piggie)",
  "We're going on a bear hunt",
  "A Bad Case of Stripes",
  "Four Mice Deep in the Jungle",
  "Pigs Make Me Sneeze!",
  "The Long Winter",
  "Geronimo Stilton #12 (Geronimo Stilton)",
  "By the shores of Silver Lake",
  "The Mitten Board Book Edition",
  "the pigeon wants a puppy!",
  "Farmer Boy",
  "My name is Stilton, Geronimo Stilton",
  "The Bad Guys: Episode 1",
  "Black beauty",
  "Ramona the Pest",
  "The Rainbow Fish",
  "Because of Mr. Terupt",
  "The House at Pooh Corner",
  "Love you forever",
  "El Deafo",
  "Pollyanna",
  "The Dimwood Chronicles",
  "Hug machine",
  "Dr. Seuss's ABC",
  "Harry the dirty dog",
  "My friend is sad",
  "No, David!",
  "The Story of Ferdinand",
  "The Snowy Day",
  "Frog and Toad All Year",
  "I am invited to a party!",
  "Are you ready to play outside?",
  "Shiloh",
  "Teach Us, Amelia Bedelia",
  "Cricket in Times Square",
  "Llama, llama red pajama",
  "Madaxkuti Bunni Ah, Madaxkuti Bunni Ah, Maxaad Aragtaa?",
  "Missing Diary",
  "Tales to give you goosebumps",
  "Hang on to Your Whiskers! (Geronimo Stilton)",
  "The Super Scam (Geronimo Stilton: Mini Mystery #1)",
  "The Tower Treasure (Hardy Boys, Book 1)",
  "Boxcar Children, Special Edition",
  "Dragon of the Red Dawn (Magic Tree House - A Merlin Mission)",
  "Stuart Little",
  "Charlotte's Web",
  "Where The Wild Things Are by Maurice Sendak (Special Edition, 1 Jan 1967) Hardcover",
];

function main() {
  const apply = process.argv.includes("--apply");
  const catalog: { title: string; author: string; genre: string }[] = JSON.parse(
    readFileSync(CATALOG_PATH, "utf8"),
  );

  const lowerSeries = SERIES_SUBSTRING_MATCHES.map((s) => s.toLowerCase());
  const lowerExact = new Set(EXACT_TITLE_MATCHES.map((s) => s.toLowerCase()));

  // D71 follow-up: title lists alone missed a picture book ("Guess How
  // Much I Love You") that landed in *Romance* via an unrelated keyword
  // overlap, invisible to a manual pass over just the Young Adult bucket.
  // Cross-check every catalog entry (every genre, not just YA) against its
  // original Open Library subjects via the same isLikelyChildrensBook
  // check the import pipeline now runs going forward (D71), joined back by
  // normalized title the same way curate-featured.ts does.
  let subjectMatchCount = 0;
  const worksByNormTitle = new Map<string, { title: string; subjects: string[] }[]>();
  try {
    const works: { title: string; subjects: string[] }[] = JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"));
    for (const w of works) {
      const norm = normalizeTitle(w.title);
      const bucket = worksByNormTitle.get(norm);
      if (bucket) bucket.push(w);
      else worksByNormTitle.set(norm, [w]);
    }
  } catch {
    console.log("No selection checkpoint found — skipping the subject-based sweep, title lists only.");
  }

  const toRemove = catalog.filter((b) => {
    const t = b.title.toLowerCase();
    if (lowerSeries.some((s) => t.includes(s)) || lowerExact.has(t)) return true;
    if (isLikelyChildrensBook(b.title, [], b.author)) return true;

    const candidates = worksByNormTitle.get(normalizeTitle(b.title));
    if (candidates?.some((w) => isLikelyChildrensBook(w.title, w.subjects))) {
      subjectMatchCount++;
      return true;
    }
    return false;
  });
  if (subjectMatchCount > 0) {
    console.log(`(${subjectMatchCount} of those matched only via the subject-based sweep, not a title list.)`);
  }

  console.log(`${toRemove.length} of ${catalog.length} books matched for removal:`);
  const byGenre: Record<string, number> = {};
  for (const b of toRemove) byGenre[b.genre] = (byGenre[b.genre] ?? 0) + 1;
  console.log("By genre:", byGenre);
  for (const b of toRemove) console.log(`  - ${b.title} by ${b.author} [${b.genre}]`);

  if (!apply) {
    console.log("\nDry run only — pass --apply to remove from the fixture and database.");
    return;
  }

  const removeKeys = new Set(toRemove.map((b) => `${b.title}::${b.author}`));
  const kept = catalog.filter((b) => !removeKeys.has(`${b.title}::${b.author}`));
  writeFileSync(CATALOG_PATH, JSON.stringify(kept, null, 2));
  console.log(`\nWrote ${kept.length} books back to ${CATALOG_PATH} (removed ${catalog.length - kept.length}).`);

  applyToDatabase(toRemove).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

async function applyToDatabase(toRemove: { title: string; author: string }[]) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const rows = await prisma.book.findMany({
      where: {
        OR: toRemove.map((b) => ({ title: b.title, author: b.author })),
      },
      select: { id: true, title: true },
    });
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      console.log("No matching rows found in the database (fixture-only change, or not yet loaded).");
      return;
    }

    const swipeCount = await prisma.swipe.count({ where: { bookId: { in: ids } } });
    const tbrCount = await prisma.tBREntry.count({ where: { bookId: { in: ids } } });
    const pickCount = await prisma.dailyPick.count({ where: { bookId: { in: ids } } });
    if (swipeCount > 0 || tbrCount > 0 || pickCount > 0) {
      console.log(
        `WARNING: deleting these ${ids.length} rows will cascade-delete ${swipeCount} swipes, ` +
          `${tbrCount} TBR entries, and ${pickCount} daily picks referencing them.`,
      );
    }

    const { count } = await prisma.book.deleteMany({ where: { id: { in: ids } } });
    console.log(`Deleted ${count} books from the database.`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
