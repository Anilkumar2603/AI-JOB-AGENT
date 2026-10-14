-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BackgroundTask" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "BackgroundTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackgroundTask_status_runAt_createdAt_idx" ON "BackgroundTask"("status", "runAt", "createdAt");

-- CreateIndex
CREATE INDEX "BackgroundTask_lockedAt_idx" ON "BackgroundTask"("lockedAt");

-- CreateIndex
CREATE INDEX "BackgroundTask_type_status_createdAt_idx" ON "BackgroundTask"("type", "status", "createdAt");
