// Pure, dependency-free — safe to import from prisma/ scripts (relative
// path, no "@/" alias needed under tsx) and from Client Components alike.
// Shared by every title-matching join across the real-catalog pipeline
// (import-open-library.ts's checkpoint join, backfill-isbns.ts,
// curate-featured.ts, curate-recent-hits.ts, scrub-childrens-books.ts,
// importMatching.ts's CSV-import fallback join) — was duplicated verbatim
// in all of them before this.
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
