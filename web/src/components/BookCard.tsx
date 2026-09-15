import { BookDetails } from "@/components/BookDetails";
import { CoverReveal } from "@/components/CoverReveal";
import type { BookWithTags } from "@/lib/books";
import { groupTags } from "@/lib/bookTags";
import type { DisplayMode } from "@/generated/prisma/enums";

// Slot order mirrors the research's discovery-signal hierarchy exactly —
// see DECISIONS.md D9. Do not reorder without checking that doc first.
export function BookCard({
  book,
  displayMode = "cover_first",
  onDetailsOpen,
}: {
  book: BookWithTags;
  displayMode?: DisplayMode;
  onDetailsOpen?: () => void;
}) {
  const tags = groupTags(book);
  const highlightTags = [...tags.mood, ...tags.trope].slice(0, 4);

  return (
    <article className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm">
      {/* 1. Cover — dominant, full-bleed (or tap-to-reveal in vibe-first mode, D31) */}
      <div className="relative aspect-[2/3] w-full bg-foreground/5">
        {displayMode === "vibe_first" ? (
          <CoverReveal src={book.coverUrl} alt={`Cover of ${book.title}`} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- local generated SVG placeholder, see DECISIONS.md D6
          <img
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* 2. Title + author */}
        <h3 className="font-serif text-lg leading-tight text-foreground">
          {book.title}
        </h3>
        <p className="text-sm text-muted">{book.author}</p>

        {/* 3. Mood + trope tags — the dominant discovery signal after the cover */}
        {highlightTags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {tags.mood.slice(0, 2).map((label) => (
              <li
                key={`mood-${label}`}
                className="rounded-full bg-tag-mood px-2.5 py-1 text-xs font-medium text-tag-mood-foreground"
              >
                {label}
              </li>
            ))}
            {tags.trope.slice(0, 2).map((label) => (
              <li
                key={`trope-${label}`}
                className="rounded-full bg-tag-trope px-2.5 py-1 text-xs font-medium text-tag-trope-foreground"
              >
                {label}
              </li>
            ))}
          </ul>
        )}

        {/* 4. Hook line — primary text element */}
        <p className="mt-3 text-base font-medium text-foreground">
          {book.hookLine}
        </p>

        {/* 5. Comp title — social proof hook */}
        {book.compTitle && (
          <p className="mt-1.5 text-sm italic text-muted">{book.compTitle}</p>
        )}

        {/* 6. Genre — secondary, deliberately lower-weight than mood/trope */}
        {tags.genre.length > 0 && (
          <div className="mt-3">
            <span className="rounded bg-tag-genre px-2 py-0.5 text-xs text-tag-genre-foreground">
              {tags.genre[0]}
            </span>
          </div>
        )}

        {/* 7. Tap-to-expand detail (full blurb, page count, heat/pacing, content warnings) */}
        <BookDetails
          blurb={book.blurb}
          pageCount={book.pageCount}
          publishedYear={book.publishedYear}
          heatLevel={book.heatLevel}
          pacing={book.pacing}
          contentWarnings={tags.content_warning}
          onOpen={onDetailsOpen}
        />
      </div>
    </article>
  );
}
