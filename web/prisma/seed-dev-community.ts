// D46: dev-only fixture for locally verifying collaborative filtering and
// the Blind Date "Community Pick" before any real multi-user data exists.
// Run manually — NEVER wired into postinstall or any automated flow, same
// convention as generate-catalog.ts. NEVER run against a shared/production
// database: this creates fake User rows with fabricated emails.
//
//   npx tsx prisma/seed-dev-community.ts
//
// After running, sign up a real test account, take the quiz picking a
// genre matching one persona below, swipe/TBR a few overlapping books, then
// reload the deck (look for "readers with similar taste" in the "Why this
// one" rail) and try /blind-date's Community Pick.

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient, TagCategory, TbrStatus, SwipeDirection } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BOOKS_PER_PERSONA = 12;

const PERSONAS = [
  { label: "cozy romance fan", genre: "Romance", email: "test-cf-cozy-romance@dev.local" },
  { label: "horror completionist", genre: "Horror", email: "test-cf-horror@dev.local" },
  { label: "sci-fi explorer", genre: "Sci-Fi", email: "test-cf-scifi@dev.local" },
  { label: "fantasy adventurer", genre: "Fantasy", email: "test-cf-fantasy@dev.local" },
  { label: "mystery solver", genre: "Mystery", email: "test-cf-mystery@dev.local" },
];

// Mostly finished (the strongest implicit + collaborative signal), some
// still reading/to_read so all three TBR-status weights get exercised.
const STATUS_CYCLE: TbrStatus[] = [
  TbrStatus.finished,
  TbrStatus.finished,
  TbrStatus.finished,
  TbrStatus.reading,
  TbrStatus.to_read,
];

async function main() {
  console.log("Creating dev-only synthetic community test users...");
  console.log("Do NOT run this against a shared/production database.\n");

  for (const persona of PERSONAS) {
    const genreTag = await prisma.tag.findFirst({
      where: { category: TagCategory.genre, label: persona.genre },
    });
    if (!genreTag) {
      console.log(`  skip ${persona.label}: no "${persona.genre}" genre tag found`);
      continue;
    }

    const books = await prisma.book.findMany({
      where: { tags: { some: { tagId: genreTag.id } } },
      take: BOOKS_PER_PERSONA,
    });
    if (books.length === 0) {
      console.log(`  skip ${persona.label}: no ${persona.genre} books found`);
      continue;
    }

    const user = await prisma.user.upsert({
      where: { email: persona.email },
      update: {},
      create: { id: randomUUID(), email: persona.email, name: `[dev] ${persona.label}` },
    });

    // Idempotent re-runs: clear this persona's prior data before rebuilding it.
    await prisma.tBREntry.deleteMany({ where: { userId: user.id } });
    await prisma.swipe.deleteMany({ where: { userId: user.id } });
    await prisma.preferenceTag.deleteMany({ where: { preference: { userId: user.id } } });
    await prisma.preference.deleteMany({ where: { userId: user.id } });

    // A real signed-up user always has a Preference (the quiz gates
    // swiping) — without one here, getCommunityPick's similarity check has
    // nothing to compare against and silently skips this persona entirely.
    // Genre + the 2 most common tropes among their books, approximating
    // what this persona would have picked in the quiz.
    const tropeCounts = new Map<string, number>();
    const bookTags = await prisma.bookTag.findMany({
      where: { bookId: { in: books.map((b) => b.id) }, tag: { category: TagCategory.trope } },
      select: { tagId: true },
    });
    for (const { tagId } of bookTags) tropeCounts.set(tagId, (tropeCounts.get(tagId) ?? 0) + 1);
    const topTropeIds = [...tropeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([tagId]) => tagId);

    await prisma.preference.create({
      data: {
        userId: user.id,
        tags: { create: [genreTag.id, ...topTropeIds].map((tagId) => ({ tagId })) },
      },
    });

    for (let i = 0; i < books.length; i++) {
      const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
      await prisma.swipe.create({
        data: { bookId: books[i].id, direction: SwipeDirection.right, userId: user.id },
      });
      await prisma.tBREntry.create({
        data: {
          bookId: books[i].id,
          userId: user.id,
          status,
          startedAt: status !== TbrStatus.to_read ? new Date() : null,
          finishedAt: status === TbrStatus.finished ? new Date() : null,
        },
      });
    }
    console.log(`  ${persona.label} (${persona.email}): ${books.length} ${persona.genre} books`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
