// One-off reclassification pass (D88) — manual-run-only, never wired into
// any automated flow. Fixes two confirmed, distinct problems with the real
// catalog's genre/trope/mood tags, diagnosed directly against the dev DB
// before writing any of this:
//
//   npx tsx prisma/reclassify-tags.ts            # dry-run: a small sample,
//                                                   live (non-batch) calls
//   npx tsx prisma/reclassify-tags.ts --submit    # submit the real batch
//                                                   for the whole catalog
//   npx tsx prisma/reclassify-tags.ts --apply     # poll/retrieve an already-
//                                                   submitted batch and
//                                                   write results to the DB
//   npx tsx prisma/reclassify-tags.ts --retry     # re-derive which books
//                                                   failed in the original
//                                                   batch and submit a new,
//                                                   smaller batch for just
//                                                   those (never re-sends
//                                                   already-succeeded books)
//   npx tsx prisma/reclassify-tags.ts --apply retry   # poll/apply the retry batch
//
// 1. Genre errors: detectGenre's isFantasy && isRomance -> "Romantasy" rule
//    (import-open-library.ts) fired on *1984* because its aggregated Open
//    Library record has a bare, contextless "fantasy" subject (same
//    cross-edition contamination pattern as D71) plus "man-woman
//    relationships" -- two independently-noisy keyword hits ANDed into a
//    confidently wrong genre. D88 already tightened the keyword lists for
//    future imports; this script re-decides genre for the *existing*
//    catalog with real judgment instead of keyword matching.
// 2. Trope/mood near-total failure (1,775 of 2,273 real books had zero
//    trope/mood tags): not a tuning problem. matchVocab substring-matches
//    65 trope / 16 mood labels -- all reader-community slang
//    ("enemies-to-lovers", "grumpy/sunshine") -- against Open Library's
//    library-cataloging-style subjects ("man-woman relationships"). Two
//    vocabularies that essentially never share literal text; no keyword
//    tuning fixes that. An LLM classification pass, given the book's real
//    title/author/description, is the only realistic way to reach the
//    requested ~80%+ accuracy bar.
//
// Uses the Batch API (50% cost, and this job -- ~2,273 requests -- fits in
// a single batch, well under the 100,000-request limit) rather than the
// live-sequential-with-retry pattern every other backfill script in this
// repo uses: this job isn't latency-sensitive, so there's no reason to pay
// full price or hand-roll per-request rate-limit pacing. The one thing this
// still needs from that pattern: the batch ID is checkpointed immediately
// after submission so an interrupted run resumes polling instead of
// resubmitting (which would double the cost).
//
// Applies to needsReview: true (real-catalog) books only -- the synthetic
// catalog was deliberately hand-authored (D6) and is untouched.

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { PrismaClient, TagCategory } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeTitle } from "../src/lib/textNormalize";

const MODEL = "claude-opus-5";
const CHECKPOINT_DIR = join(__dirname, ".import-checkpoint");
const BATCH_CHECKPOINT_PATH = join(CHECKPOINT_DIR, "reclassify-batch.json");
const RETRY_CHECKPOINT_PATH = join(CHECKPOINT_DIR, "reclassify-batch-retry.json");
const WORKS_CHECKPOINT_PATH = join(CHECKPOINT_DIR, "selected-works.json");
const DRY_RUN_SAMPLE_SIZE = 20;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const anthropic = new Anthropic();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type BookForClassification = {
  id: string;
  title: string;
  author: string;
  blurb: string;
  hintGenre: string | null;
  hintSubjects: string[] | null;
};

async function loadVocab() {
  const tags = await prisma.tag.findMany({
    where: { category: { in: [TagCategory.genre, TagCategory.trope, TagCategory.mood] } },
    select: { category: true, label: true },
  });
  return {
    genres: tags.filter((t) => t.category === TagCategory.genre).map((t) => t.label),
    tropes: tags.filter((t) => t.category === TagCategory.trope).map((t) => t.label),
    moods: tags.filter((t) => t.category === TagCategory.mood).map((t) => t.label),
  };
}

function buildSchema(genres: string[], tropes: string[], moods: string[]) {
  return z.object({
    genre: z.enum(genres as [string, ...string[]]),
    tropes: z.array(z.enum(tropes as [string, ...string[]])).max(3),
    moods: z.array(z.enum(moods as [string, ...string[]])).max(3),
    confidence: z.enum(["high", "medium", "low"]),
  });
}

function systemPrompt(genres: string[], tropes: string[], moods: string[]): string {
  return `You classify novels for a book-discovery app. Given a book's title, author, and description, choose:
- genre: exactly one, from this fixed list: ${genres.join(", ")}
- tropes: 0-3 that genuinely fit, from this fixed list: ${tropes.join(", ")}
- moods: 0-3 that genuinely fit, from this fixed list: ${moods.join(", ")}
- confidence: "high"/"medium"/"low", your own confidence in this classification

Use your own knowledge of the book (its actual content, reception, and how readers commonly describe it), not just the description text. If a "keyword-based guess" is provided, treat it as an unreliable hint only -- it comes from crude keyword matching against noisy library-catalog metadata and is confirmed wrong often (e.g. it flagged George Orwell's "1984" as "Romantasy" because of an unrelated contaminated subject tag). Only use it when it's actually consistent with what you independently know about the book.

Never force a trope or mood that doesn't genuinely fit just to fill the list -- empty arrays are fine and expected for some books. Pick the single genre that best describes the book's primary shelf category, not a secondary element of the plot.`;
}

function userPrompt(book: BookForClassification): string {
  const lines = [`Title: ${book.title}`, `Author: ${book.author}`, `Description: ${book.blurb}`];
  if (book.hintGenre) lines.push(`Keyword-based guess (unreliable, see instructions): genre=${book.hintGenre}`);
  if (book.hintSubjects?.length) lines.push(`Raw library subjects (noisy, for context only): ${book.hintSubjects.slice(0, 20).join("; ")}`);
  return lines.join("\n");
}

async function loadBooks(options: { limit?: number; ids?: string[] } = {}): Promise<BookForClassification[]> {
  const books = await prisma.book.findMany({
    where: { needsReview: true, ...(options.ids ? { id: { in: options.ids } } : {}) },
    include: { tags: { include: { tag: true } } },
    take: options.limit,
  });

  let worksByNormTitle = new Map<string, string[]>();
  if (existsSync(WORKS_CHECKPOINT_PATH)) {
    const works: { title: string; subjects?: string[] }[] = JSON.parse(readFileSync(WORKS_CHECKPOINT_PATH, "utf8"));
    worksByNormTitle = new Map(works.map((w) => [normalizeTitle(w.title), w.subjects ?? []]));
  }

  return books.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    blurb: b.blurb,
    hintGenre: b.tags.find((t) => t.tag.category === "genre")?.tag.label ?? null,
    hintSubjects: worksByNormTitle.get(normalizeTitle(b.title)) ?? null,
  }));
}

async function applyClassification(
  bookId: string,
  result: { genre: string; tropes: string[]; moods: string[] },
  tagIdByLabel: Map<string, string>
) {
  await prisma.bookTag.deleteMany({
    where: { bookId, tag: { category: { in: [TagCategory.genre, TagCategory.trope, TagCategory.mood] } } },
  });
  const labels = [result.genre, ...result.tropes, ...result.moods];
  const data = labels
    .map((label) => tagIdByLabel.get(label))
    .filter((tagId): tagId is string => Boolean(tagId))
    .map((tagId) => ({ bookId, tagId }));
  if (data.length > 0) {
    await prisma.bookTag.createMany({ data, skipDuplicates: true });
  }
}

async function dryRun() {
  const { genres, tropes, moods } = await loadVocab();
  const schema = buildSchema(genres, tropes, moods);
  const system = systemPrompt(genres, tropes, moods);

  const sample = await loadBooks({ limit: DRY_RUN_SAMPLE_SIZE });
  // Make sure the two known-bad books are in the sample if they exist.
  const known = await prisma.book.findMany({
    where: { OR: [{ title: { contains: "1984" } }, { title: { contains: "Christmas Carol" } }], needsReview: true },
    select: { id: true, title: true, author: true, blurb: true },
  });
  const extra: BookForClassification[] = known
    .filter((k) => !sample.some((s) => s.id === k.id))
    .map((k) => ({ id: k.id, title: k.title, author: k.author, blurb: k.blurb, hintGenre: null, hintSubjects: null }));

  for (const book of [...sample, ...extra]) {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userPrompt(book) }],
      output_config: { format: zodOutputFormat(schema) },
    });
    const parsed = response.parsed_output;
    console.log(`\n"${book.title}" by ${book.author}`);
    console.log("  ->", parsed);
    await sleep(200);
  }
}

function buildBatchRequests(
  books: BookForClassification[],
  schema: ReturnType<typeof buildSchema>,
  system: string
) {
  return books.map((book) => ({
    custom_id: book.id,
    params: {
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user" as const, content: userPrompt(book) }],
      output_config: { format: zodOutputFormat(schema) },
    },
  }));
}

async function submitBatch() {
  if (existsSync(BATCH_CHECKPOINT_PATH)) {
    console.log("A batch was already submitted (see reclassify-batch.json). Use --apply to poll/retrieve it.");
    return;
  }
  mkdirSync(CHECKPOINT_DIR, { recursive: true });

  const { genres, tropes, moods } = await loadVocab();
  const schema = buildSchema(genres, tropes, moods);
  const system = systemPrompt(genres, tropes, moods);
  const books = await loadBooks();
  console.log(`Submitting a batch of ${books.length} classification requests...`);

  const batch = await anthropic.messages.batches.create({ requests: buildBatchRequests(books, schema, system) });

  writeFileSync(BATCH_CHECKPOINT_PATH, JSON.stringify({ batchId: batch.id, submittedAt: new Date().toISOString(), bookCount: books.length }, null, 2));
  console.log(`Batch submitted: ${batch.id}. Checkpointed to ${BATCH_CHECKPOINT_PATH}.`);
  console.log("Run with --apply once it's done (usually within an hour) to poll and apply results.");
}

// D88 follow-up: the first full-catalog batch ran the account's credit
// balance dry partway through (607 of 2,273 requests errored with
// "credit balance is too low", confirmed by inspecting the actual error
// detail -- the original --apply only logged `result.result.type`, which
// just said "errored" and hid the real cause). Batch results stay
// available for 29 days, so this re-derives the failed set from the
// *original* batch's results rather than needing separate bookkeeping, and
// submits a new, smaller batch for only those books -- the 1,660 that
// already succeeded are never re-sent, so this can't double-spend on them.
async function retryFailed() {
  if (existsSync(RETRY_CHECKPOINT_PATH)) {
    console.log("A retry batch was already submitted (see reclassify-batch-retry.json). Use `--apply retry` to poll/retrieve it.");
    return;
  }
  if (!existsSync(BATCH_CHECKPOINT_PATH)) {
    console.log("No original batch found. Run with --submit first.");
    return;
  }
  const { batchId } = JSON.parse(readFileSync(BATCH_CHECKPOINT_PATH, "utf8"));

  const failedIds: string[] = [];
  for await (const result of await anthropic.messages.batches.results(batchId)) {
    if (result.result.type !== "succeeded") failedIds.push(result.custom_id);
  }
  if (failedIds.length === 0) {
    console.log("Nothing to retry -- every request in the original batch succeeded.");
    return;
  }
  console.log(`${failedIds.length} books need a retry. Submitting a follow-up batch...`);

  const { genres, tropes, moods } = await loadVocab();
  const schema = buildSchema(genres, tropes, moods);
  const system = systemPrompt(genres, tropes, moods);
  const books = await loadBooks({ ids: failedIds });

  const batch = await anthropic.messages.batches.create({ requests: buildBatchRequests(books, schema, system) });
  writeFileSync(RETRY_CHECKPOINT_PATH, JSON.stringify({ batchId: batch.id, submittedAt: new Date().toISOString(), bookCount: books.length }, null, 2));
  console.log(`Retry batch submitted: ${batch.id}. Checkpointed to ${RETRY_CHECKPOINT_PATH}.`);
  console.log("Run with `--apply retry` once it's done to poll and apply results.");
}

async function applyBatch(checkpointPath: string) {
  if (!existsSync(checkpointPath)) {
    console.log(`No submitted batch found at ${checkpointPath}.`);
    return;
  }
  const { batchId } = JSON.parse(readFileSync(checkpointPath, "utf8"));

  let batch = await anthropic.messages.batches.retrieve(batchId);
  while (batch.processing_status !== "ended") {
    console.log(`Status: ${batch.processing_status}, processing: ${batch.request_counts.processing}`);
    await sleep(60_000);
    batch = await anthropic.messages.batches.retrieve(batchId);
  }
  console.log(`Batch ended. Succeeded: ${batch.request_counts.succeeded}, errored: ${batch.request_counts.errored}`);

  const { genres, tropes, moods } = await loadVocab();
  const schema = buildSchema(genres, tropes, moods);
  const allTags = await prisma.tag.findMany({
    where: { category: { in: [TagCategory.genre, TagCategory.trope, TagCategory.mood] } },
  });
  const tagIdByLabel = new Map(allTags.map((t) => [t.label, t.id]));

  let applied = 0;
  let failed = 0;
  const confidenceCounts: Record<string, number> = { high: 0, medium: 0, low: 0 };
  const errorTypeCounts: Record<string, number> = {};

  for await (const result of await anthropic.messages.batches.results(batchId)) {
    if (result.result.type === "errored") {
      failed++;
      const key = result.result.error.error.type;
      errorTypeCounts[key] = (errorTypeCounts[key] ?? 0) + 1;
      continue;
    }
    if (result.result.type !== "succeeded") {
      failed++;
      console.log(`[${result.custom_id}] ${result.result.type}`);
      continue;
    }
    const textBlock = result.result.message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) {
      failed++;
      continue;
    }
    const parsed = schema.safeParse(JSON.parse(textBlock.text));
    if (!parsed.success) {
      failed++;
      console.log(`[${result.custom_id}] failed to validate output (raw: ${textBlock.text}): ${parsed.error.message}`);
      continue;
    }
    await applyClassification(result.custom_id, parsed.data, tagIdByLabel);
    confidenceCounts[parsed.data.confidence]++;
    applied++;
  }

  console.log(`\nApplied: ${applied}, failed: ${failed}.`);
  if (Object.keys(errorTypeCounts).length > 0) console.log("Error type breakdown:", errorTypeCounts);
  console.log("Confidence distribution:", confidenceCounts);
  console.log("Books with 'low' confidence are the best starting point for human review.");
}

async function main() {
  const mode = process.argv[2];
  if (mode === "--submit") await submitBatch();
  else if (mode === "--retry") await retryFailed();
  else if (mode === "--apply") await applyBatch(process.argv[3] === "retry" ? RETRY_CHECKPOINT_PATH : BATCH_CHECKPOINT_PATH);
  else await dryRun();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
