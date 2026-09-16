-- D66: flag for real-imported books whose heat/pacing are placeholder
-- defaults and whose trope/mood tags are a low-recall automated guess.
ALTER TABLE "Book" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false;
