// Phase 3 matching (D45/D46): the Phase 1 baseline (D25, deterministic
// tag-overlap) is kept as the explicit-preference layer, not replaced —
// it's still what a brand-new account is scored on before they have any
// history. On top of it: an implicit layer learned from the actor's own
// swipe/TBR/reading-completion history (D45, "expands over time" per actor),
// and a collaborative layer from what similar signed-in readers have
// finished/added (D46, "expands over time" for the system as a whole —
// zero-effect today with 0-1 real accounts, strengthens automatically as
// real users sign up; see prisma/seed-dev-community.ts to exercise it
// locally before that happens).

import { prisma } from "@/lib/prisma";
import { HeatLevel, SwipeDirection, TbrStatus } from "@/generated/prisma/enums";
import type { BookWithTags } from "@/lib/books";
import type { PreferenceWithTags } from "@/lib/preferences";
import type { Actor } from "@/lib/actor";
import { actorWhere } from "@/lib/actor";
import { CATEGORY_WEIGHT, CURRENT_MOOD_BOOST } from "@/lib/matchReasons";
import { EXPLORE_RATIO } from "@/lib/constants";

const HEAT_ORDER: HeatLevel[] = [
  HeatLevel.none,
  HeatLevel.low,
  HeatLevel.medium,
  HeatLevel.high,
];

// --- Explicit layer (D25 baseline, unchanged in spirit) --------------------

export function explicitWeightsFromPreference(preference: PreferenceWithTags): Map<string, number> {
  const weights = new Map<string, number>();
  for (const { tag } of preference.tags) {
    if (tag.category === "content_warning") continue; // hard-filtered, never a positive weight
    weights.set(tag.id, (weights.get(tag.id) ?? 0) + (CATEGORY_WEIGHT[tag.category] ?? 1));
  }
  return weights;
}

export function mergeWeights(...maps: Map<string, number>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const map of maps) {
    for (const [tagId, amount] of map) out.set(tagId, (out.get(tagId) ?? 0) + amount);
  }
  return out;
}

// D50: "how well does this reader match MY profile" — deliberately
// asymmetric, not full-vector cosine. An early tried version used cosine
// similarity over the full tag-weight vectors, but that punishes an
// established reader for simply having accumulated many OTHER tags the
// asking actor hasn't touched at all (a "horror completionist" with a rich
// 12-book history scored barely 0.1-0.2 cosine-similar to a fresh quiz-only
// horror fan, even though they align on everything the fresh reader
// actually cares about) — verified empirically before shipping this
// version, not assumed. What actually answers "is this reader like me" is:
// of MY top preferences, how much weight do they also share? Someone with
// a huge unrelated back-catalog doesn't get penalized for it.
const TOP_TAGS_FOR_SIMILARITY = 8;

export function profileSimilarity(mine: Map<string, number>, theirs: Map<string, number>): number {
  const myTopTags = [...mine.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_TAGS_FOR_SIMILARITY);

  let matched = 0;
  let total = 0;
  for (const [tagId, myWeight] of myTopTags) {
    matched += Math.min(myWeight, Math.max(0, theirs.get(tagId) ?? 0));
    total += myWeight;
  }
  return total > 0 ? matched / total : 0;
}

// --- Implicit layer (D45/D49): learned from the actor's own history --------
//
// D49 added two things on top of the original flat accumulation, from a
// direct product concern: without them, a single "finished" (+4) in a genre
// you've never otherwise touched could already outweigh an explicit quiz
// pick (+3), so a short binge in something new could suddenly dominate the
// main feed. Neither change touches the explicit (quiz) layer — a stated
// preference doesn't decay or need "proving."
//
// 1. Time decay (exponential half-life) — recent activity counts more, nothing
//    is ever fully forgotten, so the signal keeps being "cumulative over
//    time" per the product ask, just recency-weighted.
// 2. Confidence dampening — a tag needs several touches (not necessarily
//    recent ones) before its full weight is allowed into the main scoring
//    that decides the top ~80% exploit tier. The undamped residual
//    ("emerging" interest) doesn't just vanish — composeExploreExploitDeck
//    uses it to bias which candidates land in the ~20% explore slice, so a
//    new genre you're just starting to explore surfaces there "on
//    occasion" before it's earned a place in your main feed.

const IMPLICIT_HALF_LIFE_DAYS = 30;
const IMPLICIT_CONFIDENCE_THRESHOLD = 5; // distinct touches for a tag to fully count

const IMPLICIT_SWIPE_WEIGHT: Record<SwipeDirection, number> = {
  [SwipeDirection.right]: 1,
  [SwipeDirection.left]: -1,
};
// Deliberately not exhaustive — `to_read` contributes nothing extra here
// (it's already counted via the right-swipe that created it); only later,
// more deliberate status changes add on top of that base.
const IMPLICIT_STATUS_WEIGHT: Partial<Record<TbrStatus, number>> = {
  reading: 2,
  finished: 4, // research: completion is "the highest-quality signal available"
  dnf: -2,
};
const VIEWED_DETAILS_MULTIPLIER = 1.5;

function decayFactor(eventDate: Date, now: number): number {
  const ageDays = (now - eventDate.getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, Math.max(0, ageDays) / IMPLICIT_HALF_LIFE_DAYS);
}

export type ImplicitTagWeights = {
  // Time-decayed AND confidence-dampened — what's safe to feed into the
  // main score (scoreBook), since it can't yet be dominated by a handful
  // of recent touches on something new.
  stable: Map<string, number>;
  // The undamped residual for tags that haven't earned full confidence —
  // never used for the main score, only to bias explore-slot selection.
  emerging: Map<string, number>;
};

export async function getImplicitTagWeights(actor: Actor): Promise<ImplicitTagWeights> {
  const now = Date.now();
  const rawWeight = new Map<string, number>();
  const touchCount = new Map<string, number>();
  const bump = (tagId: string, amount: number) => {
    rawWeight.set(tagId, (rawWeight.get(tagId) ?? 0) + amount);
    touchCount.set(tagId, (touchCount.get(tagId) ?? 0) + 1);
  };

  const swipes = await prisma.swipe.findMany({
    where: actorWhere(actor),
    select: {
      direction: true,
      viewedDetails: true,
      createdAt: true,
      book: { select: { tags: { select: { tagId: true } } } },
    },
  });
  for (const swipe of swipes) {
    const base = IMPLICIT_SWIPE_WEIGHT[swipe.direction];
    const amount =
      (swipe.viewedDetails ? base * VIEWED_DETAILS_MULTIPLIER : base) * decayFactor(swipe.createdAt, now);
    for (const { tagId } of swipe.book.tags) bump(tagId, amount);
  }

  const entries = await prisma.tBREntry.findMany({
    // D83: excludes onboarding-imported "already read" entries (D81) —
    // those carry no real preference judgment (marking an author's whole
    // backlist as read isn't the same as liking any of it), but status:
    // finished is otherwise this function's single strongest, undecayed
    // signal. Letting those through could override what the reader just
    // told the quiz with books they may not have even enjoyed.
    where: { ...actorWhere(actor), fromOnboardingImport: false },
    select: {
      status: true,
      startedAt: true,
      finishedAt: true,
      addedAt: true,
      book: { select: { tags: { select: { tagId: true } } } },
    },
  });
  for (const entry of entries) {
    const base = IMPLICIT_STATUS_WEIGHT[entry.status];
    if (!base) continue;
    // Decay from whichever timestamp that status actually reflects — a book
    // finished a year ago shouldn't count as "recent" just because it was
    // added to the shelf yesterday.
    const referenceDate = entry.finishedAt ?? entry.startedAt ?? entry.addedAt;
    const amount = base * decayFactor(referenceDate, now);
    for (const { tagId } of entry.book.tags) bump(tagId, amount);
  }

  const stable = new Map<string, number>();
  const emerging = new Map<string, number>();
  for (const [tagId, raw] of rawWeight) {
    const confidence = Math.min(1, (touchCount.get(tagId) ?? 0) / IMPLICIT_CONFIDENCE_THRESHOLD);
    stable.set(tagId, raw * confidence);
    emerging.set(tagId, raw * (1 - confidence));
  }

  return { stable, emerging };
}

// --- Collaborative layer (D46): "readers like you" -------------------------
// Simple overlap join, exactly the "v1, before real ML" scope the roadmap
// calls for — not a recommendation model. Signed-in users only (a stable
// identity is needed for "similar reader"; anonymous sessions are ephemeral).

const COLLABORATIVE_SIMILAR_USER_LIMIT = 20;
const COLLABORATIVE_STATUS_WEIGHT: Partial<Record<TbrStatus, number>> = {
  finished: 1,
  reading: 0.6,
  to_read: 0.4,
};
const COLLABORATIVE_BOOST_SCALE = 2;
const COLLABORATIVE_BOOST_CAP = 6;

export async function getCollaborativeBoosts(
  actor: Actor,
  candidateBookIds: string[]
): Promise<Map<string, number>> {
  if (actor.kind !== "user" || candidateBookIds.length === 0) return new Map();

  // D83: same reasoning as getImplicitTagWeights above — an onboarding-
  // imported "already read" entry (D81) isn't a real taste signal (bulk-
  // selecting an author's whole backlist isn't the same as liking any of
  // it), so it shouldn't count toward "who reads like me" overlap, nor
  // toward "similar readers finished this" boosts for others.
  const myEntries = await prisma.tBREntry.findMany({
    where: { userId: actor.userId, fromOnboardingImport: false },
    select: { bookId: true },
  });
  const myBookIds = myEntries.map((e) => e.bookId);
  if (myBookIds.length === 0) return new Map();

  // Other signed-in readers who share at least one TBR/finished book with us.
  const overlapping = await prisma.tBREntry.findMany({
    where: { bookId: { in: myBookIds }, userId: { not: actor.userId }, fromOnboardingImport: false },
    select: { userId: true },
  });
  const overlapCount = new Map<string, number>();
  for (const e of overlapping) {
    if (!e.userId) continue;
    overlapCount.set(e.userId, (overlapCount.get(e.userId) ?? 0) + 1);
  }
  const similarUserIds = [...overlapCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, COLLABORATIVE_SIMILAR_USER_LIMIT)
    .map(([userId]) => userId);
  if (similarUserIds.length === 0) return new Map();

  const theirEntries = await prisma.tBREntry.findMany({
    where: { userId: { in: similarUserIds }, bookId: { in: candidateBookIds }, fromOnboardingImport: false },
    select: { bookId: true, status: true },
  });

  const boosts = new Map<string, number>();
  for (const e of theirEntries) {
    const weight = COLLABORATIVE_STATUS_WEIGHT[e.status] ?? 0;
    if (!weight) continue;
    const current = boosts.get(e.bookId) ?? 0;
    boosts.set(e.bookId, Math.min(COLLABORATIVE_BOOST_CAP, current + weight * COLLABORATIVE_BOOST_SCALE));
  }
  return boosts;
}

// --- Scoring -----------------------------------------------------------
//
// D65: found live — a reader who picked "dark" as a mood but never touched
// any romance tag was getting dark romance recommendations. Root cause
// traced (not assumed): the catalog's mood assignment is genre-agnostic by
// design (generate-catalog.ts picks moods independent of genre, verified by
// counting "dark"-tagged books per genre — no romance skew in the data
// itself), but the OLD scoring below summed every matched tag's weight with
// no requirement that a book's genre also line up with anything the reader
// actually picked. Mood/trope are weighted 3x (CATEGORY_WEIGHT) and genre
// only 1x, so 2-3 incidental mood matches (very likely given only ~16 mood
// options total) could outscore genuine genre-aligned books outright, for
// ANY genre, since an unselected genre carries no penalty at all — only
// zero weight, same as never being mentioned.
//
// Three changes, aimed straight at that mechanism:
// 1. Genre alignment gate: if the reader selected at least one genre,
//    mood+trope contributions are discounted (not zeroed — see below) on a
//    book whose OWN genre isn't one of them. A strong genre-agnostic mood
//    match can no longer single-handedly out-rank real genre alignment.
// 2. A flat bonus for genre alignment itself, on top of the existing 1x tag
//    weight — verified empirically (a throwaway script scoring real catalog
//    books) that the tag weight alone wasn't enough: a book matching only
//    the selected genre (no mood/trope overlap at all) was still scoring
//    BELOW an off-genre book with just one discounted mood match, exactly
//    backwards from what "genre is the primary signal" should mean.
// 3. Category coverage bonus: a book scoring across multiple categories
//    (mood AND trope, or mood AND trope AND genre) gets a small bonus on
//    top of the raw sum — "several tags line up" is rewarded as its own
//    signal, not just whichever category happens to carry the most weight.
//
// GENRE_MISMATCH_DISCOUNT is a discount, not a hard exclusion — on purpose:
// the ask was for "some slight variation," not a rigid genre-only feed. A
// genuinely strong off-genre mood/trope match can still surface, just
// discounted enough that genre-aligned books consistently win the main
// deck, and it lands more often in the explore slice
// (composeExploreExploitDeck) than the main exploit deck as a natural side
// effect of sorting lower — no special-casing needed there.
const GENRE_MISMATCH_DISCOUNT = 0.2;
const GENRE_ALIGNED_BONUS = 2;
const CATEGORY_COVERAGE_BONUS = 2;

function scoreBook(
  book: BookWithTags,
  tagWeights: Map<string, number>,
  heatLevelMax: HeatLevel | null,
  pacing: string | null,
  currentMoodTagId: string | null,
  collaborativeBoost: number,
  selectedGenreIds: Set<string>
): number {
  const categoryScore: Partial<Record<string, number>> = {};
  for (const { tag } of book.tags) {
    if (tag.category === "content_warning") continue; // hard-filtered elsewhere, D24
    let contribution = tagWeights.get(tag.id) ?? 0;
    if (currentMoodTagId && tag.id === currentMoodTagId) {
      contribution += CURRENT_MOOD_BOOST;
    }
    categoryScore[tag.category] = (categoryScore[tag.category] ?? 0) + contribution;
  }

  const bookGenreTagId = book.tags.find(({ tag }) => tag.category === "genre")?.tagId;
  const genreWasSelected = selectedGenreIds.size > 0;
  const genreAligned = !genreWasSelected || (bookGenreTagId != null && selectedGenreIds.has(bookGenreTagId));
  const moodTropeMultiplier = genreAligned ? 1 : GENRE_MISMATCH_DISCOUNT;

  let score =
    (categoryScore.mood ?? 0) * moodTropeMultiplier +
    (categoryScore.trope ?? 0) * moodTropeMultiplier +
    (categoryScore.genre ?? 0) +
    (genreWasSelected && genreAligned ? GENRE_ALIGNED_BONUS : 0);

  const matchedCategoryCount = ["mood", "trope", "genre"].filter(
    (category) => (categoryScore[category] ?? 0) > 0
  ).length;
  if (matchedCategoryCount > 1) score += (matchedCategoryCount - 1) * CATEGORY_COVERAGE_BONUS;

  if (pacing && book.pacing === pacing) score += 1;

  if (heatLevelMax) {
    const bookIdx = HEAT_ORDER.indexOf(book.heatLevel);
    const maxIdx = HEAT_ORDER.indexOf(heatLevelMax);
    score += bookIdx <= maxIdx ? 1 : -2;
  }

  score += collaborativeBoost;

  // small jitter so ties (including an all-zero score for a cold-start
  // preference with no liked tags yet) don't render in the same order every time
  score += Math.random() * 0.5;

  return score;
}

// --- Deck composition (D47): 80/20 explore/exploit --------------------------

// Weighted sampling without replacement (the standard "A-Res" trick: give
// each item a random key raised to 1/weight, take the top K by key) — like
// shuffle-and-slice, but items with a higher weight are more likely, not
// equally likely, to be picked. Weight 0 can still occasionally win, so an
// EXPLORE_RATIO deck still gets some non-novelty variety, not only whatever
// currently has emerging interest.
function weightedSample<T>(items: T[], weight: (item: T) => number, k: number): T[] {
  return items
    .map((item) => ({ item, key: Math.random() ** (1 / Math.max(0.001, weight(item))) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map(({ item }) => item);
}

// D49: how much a candidate's not-yet-confident tags (see
// getImplicitTagWeights' `emerging` map) should bias it toward an explore
// slot specifically — this is the "on occasion" surfacing for a genre/trope
// you've just started touching, without letting it into the main score.
const NOVELTY_EXPLORE_WEIGHT = 2;

function noveltyScore(book: BookWithTags, emergingWeights: Map<string, number>): number {
  let score = 0;
  for (const { tag } of book.tags) score += Math.max(0, emergingWeights.get(tag.id) ?? 0);
  return score;
}

// Interleaves a minority of real-but-less-likely matches into the deck
// (roughly every 5th slot, not clumped) instead of a pure top-N cut — the
// "still show less-likely matches periodically" behavior. Exploration
// candidates come from the upper-middle of what's left after the exploit
// slice, not the literal bottom of the ranking, so they're a genuine if
// less obvious match rather than random noise; candidates touching an
// emerging (not-yet-confident) interest are weighted higher within that
// sample, not guaranteed, so a new genre shows up periodically rather than
// flooding even the explore slice.
function composeExploreExploitDeck(
  scored: { book: BookWithTags; score: number }[],
  limit: number,
  emergingWeights: Map<string, number>
): BookWithTags[] {
  const exploitCount = Math.max(1, Math.round(limit * (1 - EXPLORE_RATIO)));
  const exploitPool = scored.slice(0, exploitCount);
  const remainder = scored.slice(exploitCount);

  const exploreCount = Math.min(limit - exploitPool.length, remainder.length);
  const explorePoolEnd = Math.max(exploreCount, Math.ceil(remainder.length / 2));
  const explorePool = remainder.slice(0, explorePoolEnd);
  const exploreSample = weightedSample(
    explorePool,
    (r) => 1 + noveltyScore(r.book, emergingWeights) * NOVELTY_EXPLORE_WEIGHT,
    exploreCount
  );

  const result: BookWithTags[] = [];
  let exploitIdx = 0;
  let exploreIdx = 0;
  const interval = exploreSample.length > 0 ? Math.max(2, Math.floor(exploitPool.length / exploreSample.length)) : Infinity;
  while (exploitIdx < exploitPool.length || exploreIdx < exploreSample.length) {
    const nextIsExplore =
      exploreIdx < exploreSample.length &&
      ((result.length + 1) % (interval + 1) === 0 || exploitIdx >= exploitPool.length);
    if (nextIsExplore) {
      result.push(exploreSample[exploreIdx++].book);
    } else {
      result.push(exploitPool[exploitIdx++].book);
    }
  }
  return result;
}

// --- Public entry point -----------------------------------------------

export type DeckResult = {
  books: BookWithTags[];
  tagWeights: Record<string, number>;
  collaborativeBoosts: Record<string, number>;
};

export async function getDeckForPreference(
  actor: Actor,
  preference: PreferenceWithTags,
  excludeBookIds: string[],
  limit: number,
  options: { explore?: boolean } = {}
): Promise<DeckResult> {
  const avoidTagIds = preference.tags
    .filter(({ tag }) => tag.category === "content_warning")
    .map(({ tagId }) => tagId);

  const candidates = await prisma.book.findMany({
    where: {
      id: { notIn: excludeBookIds.length ? excludeBookIds : undefined },
      ...(avoidTagIds.length
        ? { tags: { none: { tagId: { in: avoidTagIds } } } }
        : {}),
    },
    include: { tags: { include: { tag: true } } },
    take: 300, // cap the scoring pool; plenty of headroom over the current catalog size
  });

  const explicitWeights = explicitWeightsFromPreference(preference);
  const implicit = await getImplicitTagWeights(actor);
  const tagWeights = mergeWeights(explicitWeights, implicit.stable);
  const collaborativeBoosts = await getCollaborativeBoosts(actor, candidates.map((c) => c.id));

  // D65: explicit quiz genre picks only — the clearest, most direct signal
  // of "what kind of book is this" for the mismatch discount in scoreBook.
  const selectedGenreIds = new Set(
    preference.tags.filter(({ tag }) => tag.category === "genre").map(({ tagId }) => tagId)
  );

  const scored = candidates
    .map((book) => ({
      book,
      score: scoreBook(
        book,
        tagWeights,
        preference.heatLevelMax,
        preference.pacing,
        preference.currentMoodTagId,
        collaborativeBoosts.get(book.id) ?? 0,
        selectedGenreIds
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const explore = options.explore ?? true;
  const books = explore
    ? composeExploreExploitDeck(scored, limit, implicit.emerging)
    : scored.slice(0, limit).map(({ book }) => book);

  return {
    books,
    tagWeights: Object.fromEntries(tagWeights),
    collaborativeBoosts: Object.fromEntries(collaborativeBoosts),
  };
}
