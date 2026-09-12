-- AlterTable
ALTER TABLE "Preference" ADD COLUMN "currentMoodTagId" TEXT;

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_currentMoodTagId_fkey" FOREIGN KEY ("currentMoodTagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
