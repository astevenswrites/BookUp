-- CreateTable
CREATE TABLE "WeeklyPick" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "sessionId" TEXT,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "WeeklyPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyPick_userId_weekKey_idx" ON "WeeklyPick"("userId", "weekKey");

-- CreateIndex
CREATE INDEX "WeeklyPick_sessionId_weekKey_idx" ON "WeeklyPick"("sessionId", "weekKey");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPick_bookId_weekKey_userId_sessionId_key" ON "WeeklyPick"("bookId", "weekKey", "userId", "sessionId");

-- AddForeignKey
ALTER TABLE "WeeklyPick" ADD CONSTRAINT "WeeklyPick_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPick" ADD CONSTRAINT "WeeklyPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
