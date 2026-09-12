-- CreateEnum
CREATE TYPE "HeatLevel" AS ENUM ('none', 'low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "Pacing" AS ENUM ('slow_burn', 'medium', 'fast_paced');

-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('genre', 'trope', 'mood', 'content_warning');

-- CreateEnum
CREATE TYPE "SwipeDirection" AS ENUM ('left', 'right');

-- CreateEnum
CREATE TYPE "TbrStatus" AS ENUM ('to_read', 'reading', 'finished', 'dnf');

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "blurb" TEXT NOT NULL,
    "compTitle" TEXT,
    "coverUrl" TEXT NOT NULL,
    "heatLevel" "HeatLevel" NOT NULL,
    "pacing" "Pacing" NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "publishedYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "TagCategory" NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookTag" (
    "bookId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "BookTag_pkey" PRIMARY KEY ("bookId","tagId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Swipe" (
    "id" TEXT NOT NULL,
    "direction" "SwipeDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "sessionId" TEXT,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "Swipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TBREntry" (
    "id" TEXT NOT NULL,
    "status" "TbrStatus" NOT NULL DEFAULT 'to_read',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "TBREntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_label_category_key" ON "Tag"("label", "category");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Swipe_userId_idx" ON "Swipe"("userId");

-- CreateIndex
CREATE INDEX "Swipe_sessionId_idx" ON "Swipe"("sessionId");

-- CreateIndex
CREATE INDEX "Swipe_bookId_idx" ON "Swipe"("bookId");

-- CreateIndex
CREATE INDEX "TBREntry_userId_idx" ON "TBREntry"("userId");

-- CreateIndex
CREATE INDEX "TBREntry_sessionId_idx" ON "TBREntry"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TBREntry_bookId_userId_sessionId_key" ON "TBREntry"("bookId", "userId", "sessionId");

-- AddForeignKey
ALTER TABLE "BookTag" ADD CONSTRAINT "BookTag_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookTag" ADD CONSTRAINT "BookTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TBREntry" ADD CONSTRAINT "TBREntry_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TBREntry" ADD CONSTRAINT "TBREntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
