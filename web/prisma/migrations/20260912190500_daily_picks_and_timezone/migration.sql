-- AlterTable
ALTER TABLE "Preference" ADD COLUMN "timezone" TEXT;

-- CreateTable
CREATE TABLE "DailyPick" (
    "id" TEXT NOT NULL,
    "pickDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "sessionId" TEXT,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "DailyPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyPick_userId_pickDate_idx" ON "DailyPick"("userId", "pickDate");

-- CreateIndex
CREATE INDEX "DailyPick_sessionId_pickDate_idx" ON "DailyPick"("sessionId", "pickDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPick_bookId_pickDate_userId_sessionId_key" ON "DailyPick"("bookId", "pickDate", "userId", "sessionId");

-- AddForeignKey
ALTER TABLE "DailyPick" ADD CONSTRAINT "DailyPick_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPick" ADD CONSTRAINT "DailyPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
