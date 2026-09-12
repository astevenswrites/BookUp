-- CreateEnum
CREATE TYPE "ReadingFrequency" AS ENUM ('casual', 'regular', 'voracious');

-- CreateTable
CREATE TABLE "Preference" (
    "id" TEXT NOT NULL,
    "heatLevelMax" "HeatLevel",
    "pacing" "Pacing",
    "readingFrequency" "ReadingFrequency",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "Preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceTag" (
    "preferenceId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "PreferenceTag_pkey" PRIMARY KEY ("preferenceId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Preference_userId_key" ON "Preference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Preference_sessionId_key" ON "Preference"("sessionId");

-- AddForeignKey
ALTER TABLE "PreferenceTag" ADD CONSTRAINT "PreferenceTag_preferenceId_fkey" FOREIGN KEY ("preferenceId") REFERENCES "Preference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceTag" ADD CONSTRAINT "PreferenceTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
