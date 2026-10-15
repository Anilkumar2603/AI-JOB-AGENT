-- CreateEnum
CREATE TYPE "ResumeUploadStatus" AS ENUM ('READY', 'FAILED');

-- CreateTable
CREATE TABLE "UploadedResume" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "status" "ResumeUploadStatus" NOT NULL DEFAULT 'READY',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedResume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadedResume_storageKey_key" ON "UploadedResume"("storageKey");

-- CreateIndex
CREATE INDEX "UploadedResume_profileId_createdAt_idx" ON "UploadedResume"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "UploadedResume_profileId_status_idx" ON "UploadedResume"("profileId", "status");

-- AddForeignKey
ALTER TABLE "UploadedResume" ADD CONSTRAINT "UploadedResume_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
