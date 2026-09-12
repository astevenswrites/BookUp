-- CreateEnum
CREATE TYPE "DisplayMode" AS ENUM ('cover_first', 'vibe_first');

-- AlterTable
ALTER TABLE "Preference" ADD COLUMN "favoriteBooksNote" TEXT;
ALTER TABLE "Preference" ADD COLUMN "displayMode" "DisplayMode" NOT NULL DEFAULT 'cover_first';
