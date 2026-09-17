// Pure, dependency-free — safe to import from prisma/ scripts (relative
// path) and from Client Components alike (importParsing.ts's CSV row
// parsing needs it, since a Goodreads/StoryGraph export can carry either
// ISBN-10 or ISBN-13 depending on what the source had on file).
//
// D84: Open Library editions carry both isbn_13 and isbn_10 per edition,
// and every script that pulled an ISBN out of one picked
// `isbn_13?.[0] ?? isbn_10?.[0]` independently (import-open-library.ts,
// backfill-isbns.ts) — so Book.isbn ended up storing whichever format that
// particular edition happened to expose first, inconsistently across rows.
// The CSV importer (importMatching.ts) does an exact-string match against
// that column, so a book stored as ISBN-10 silently fails to match a CSV
// row carrying the same book's ISBN-13 (Goodreads prefers ISBN13 when
// present) and vice versa. Converting every ISBN-10 to its equivalent
// ISBN-13 at the point of storage AND at the point of matching makes the
// comparison format-independent instead of relying on both sides having
// picked the same one.
export function toIsbn13(isbn: string): string | null {
  const digits = isbn.replace(/[^0-9Xx]/g, "");
  if (digits.length === 13) return digits;
  if (digits.length !== 10) return null;

  const core = "978" + digits.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return core + checkDigit;
}
