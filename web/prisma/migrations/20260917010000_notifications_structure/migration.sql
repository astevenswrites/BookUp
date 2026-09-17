-- CreateEnum
CREATE TYPE "NotificationFrequency" AS ENUM ('off', 'daily', 'weekly');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('tbr_reminder', 'weekly_drop_ready');

-- AlterTable
ALTER TABLE "Preference" ADD COLUMN "notificationFrequency" "NotificationFrequency" NOT NULL DEFAULT 'off';

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowKey" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationLog_userId_windowKey_idx" ON "NotificationLog"("userId", "windowKey");

-- CreateIndex
CREATE INDEX "NotificationLog_sessionId_windowKey_idx" ON "NotificationLog"("sessionId", "windowKey");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EnableRowLevelSecurity (D56/D76/D77 pattern: zero policies, closes the PostgREST anon-key path; the app's postgres role has rolbypassrls=true so this has no effect on Prisma itself)
ALTER TABLE "NotificationLog" ENABLE ROW LEVEL SECURITY;
