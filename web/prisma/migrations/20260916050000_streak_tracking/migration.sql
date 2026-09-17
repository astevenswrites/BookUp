-- AlterTable
ALTER TABLE "Preference" ADD COLUMN "currentStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Preference" ADD COLUMN "longestStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Preference" ADD COLUMN "lastActiveDate" TEXT;
