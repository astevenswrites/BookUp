// D82 (split from importMatching.ts per D32's rule — a file mixing a pure
// helper with a Prisma-backed function pulls the WHOLE module, Prisma
// included, into any Client Component that imports the pure half; caught
// live when AlreadyReadFlow.tsx's `detectImportFormat` import crashed the
// build with "next/headers... only available in Server Components"):
// everything here is pure, framework-agnostic parsing — safe to import
// from a Client Component (AlreadyReadFlow.tsx does, for live format
// detection right after a file is selected). The actual catalog matching
// (Prisma, actor-scoped exclusion) lives in importMatching.ts instead.
import { toIsbn13 } from "@/lib/isbn";

export type ImportFormat = "goodreads" | "storygraph";

export type ImportedRow = {
  title: string;
  author: string;
  isbn: string | null;
  status: "read" | "reading" | "to_read" | "other";
};

export function detectImportFormat(headers: string[]): ImportFormat | null {
  if (headers.includes("Exclusive Shelf")) return "goodreads";
  if (headers.includes("Read Status")) return "storygraph";
  return null;
}

// Goodreads wraps ISBN columns as `="9780000000000"` specifically so
// spreadsheet apps don't "helpfully" convert the long digit string to
// scientific notation — confirmed directly from a real export sample, not
// assumed. Harmless to run on a plain digit string too (no-op).
//
// D84: also normalizes to ISBN-13 — a CSV can carry either format
// (Goodreads' plain "ISBN" column is ISBN-10; StoryGraph's "ISBN/UID" is
// unconfirmed either way) and importMatching.ts does an exact-string match
// against Book.isbn, which is stored as ISBN-13 (see src/lib/isbn.ts). A
// row whose ISBN doesn't convert cleanly (garbage/truncated data) falls
// through to the title+author fallback match instead of never matching.
function cleanIsbn(raw: string | undefined): string | null {
  if (!raw) return null;
  const stripped = raw.replace(/^="?|"?$/g, "").trim();
  if (!stripped) return null;
  return toIsbn13(stripped) ?? stripped;
}

function parseGoodreadsRow(row: Record<string, string>): ImportedRow {
  const shelf = (row["Exclusive Shelf"] ?? "").toLowerCase().trim();
  const status: ImportedRow["status"] =
    shelf === "read" ? "read" : shelf === "currently-reading" ? "reading" : shelf === "to-read" ? "to_read" : "other";
  return {
    title: row["Title"] ?? "",
    author: row["Author"] ?? "",
    isbn: cleanIsbn(row["ISBN13"]) ?? cleanIsbn(row["ISBN"]),
    status,
  };
}

// StoryGraph's exact "Read Status" values aren't nailed down as precisely
// as Goodreads' (confirmed the column name and that it holds a read-status
// string, not every possible value it takes) — matched by substring
// instead of an exact enum so reasonable wording variants ("Read", "read",
// "Currently Reading") don't silently fall through to "other".
function parseStoryGraphRow(row: Record<string, string>): ImportedRow {
  const readStatus = (row["Read Status"] ?? "").toLowerCase();
  const status: ImportedRow["status"] = readStatus.includes("currently")
    ? "reading"
    : readStatus.includes("to read") || readStatus.includes("want")
      ? "to_read"
      : readStatus.includes("read")
        ? "read"
        : "other";
  const author = (row["Authors"] ?? "").split(/[,;]| and /i)[0]?.trim() ?? "";
  return {
    title: row["Title"] ?? "",
    author,
    isbn: cleanIsbn(row["ISBN/UID"]),
    status,
  };
}

export function parseImportRows(format: ImportFormat, rows: Record<string, string>[]): ImportedRow[] {
  return rows.map(format === "goodreads" ? parseGoodreadsRow : parseStoryGraphRow);
}
