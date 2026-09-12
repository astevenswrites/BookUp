-- CreateEnum
CREATE TYPE "VibeTheme" AS ENUM ('cozy', 'dark', 'whimsical', 'melancholy');

-- AlterTable
ALTER TABLE "Preference" ADD COLUMN "themeOverride" "VibeTheme";
