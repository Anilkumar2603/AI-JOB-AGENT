-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SkillRequirement" AS ENUM ('REQUIRED', 'PREFERRED');

-- CreateEnum
CREATE TYPE "JobSourceType" AS ENUM ('PUBLIC_API', 'CAREER_PAGE', 'AGGREGATOR', 'MANUAL_IMPORT');

-- CreateEnum
CREATE TYPE "JobListingStatus" AS ENUM ('ACTIVE', 'CLOSED', 'EXPIRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RemotePreference" AS ENUM ('ANY', 'REMOTE_ONLY', 'ONSITE_OR_HYBRID');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "ReviewBatchStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('REVIEW_PENDING', 'APPROVED', 'SUBMITTED', 'INTERVIEW', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experience" JSONB NOT NULL,
    "projects" JSONB NOT NULL,
    "education" JSONB NOT NULL,
    "preferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetRole" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alternativeTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "locations" TEXT[] DEFAULT ARRAY['India']::TEXT[],
    "remotePreference" "RemotePreference" NOT NULL DEFAULT 'ANY',
    "minExperienceMonths" INTEGER,
    "maxExperienceMonths" INTEGER,
    "minSalaryAnnual" INTEGER,
    "maxSalaryAnnual" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'INR',
    "minFitScore" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "TargetRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleSkill" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requirementType" "SkillRequirement" NOT NULL DEFAULT 'REQUIRED',
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RoleSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "JobSourceType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "attribution" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'UNKNOWN',
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "minExperienceMonths" INTEGER,
    "maxExperienceMonths" INTEGER,
    "minSalaryAnnual" INTEGER,
    "maxSalaryAnnual" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'INR',
    "listingStatus" "JobListingStatus" NOT NULL DEFAULT 'UNKNOWN',
    "postedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMatch" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scoringVersion" INTEGER NOT NULL DEFAULT 1,
    "score" INTEGER NOT NULL,
    "eligibility" "EligibilityStatus" NOT NULL DEFAULT 'UNCERTAIN',
    "meetsThreshold" BOOLEAN NOT NULL DEFAULT false,
    "matchedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingRequiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasons" JSONB NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewBatch" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "ReviewBatchStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "jobMatchId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "targetRoleId" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'REVIEW_PENDING',
    "fitScoreAtApplication" INTEGER NOT NULL,
    "fitReasons" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "approvedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "docxStorageKey" TEXT,
    "pdfStorageKey" TEXT,
    "contentHash" TEXT,
    "templateVersion" TEXT NOT NULL,
    "validation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "trigger" "SyncTrigger" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "jobsFound" INTEGER NOT NULL DEFAULT 0,
    "jobsCreated" INTEGER NOT NULL DEFAULT 0,
    "jobsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "stats" JSONB,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_email_key" ON "CandidateProfile"("email");

-- CreateIndex
CREATE INDEX "TargetRole_profileId_status_idx" ON "TargetRole"("profileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TargetRole_profileId_name_key" ON "TargetRole"("profileId", "name");

-- CreateIndex
CREATE INDEX "RoleSkill_roleId_requirementType_idx" ON "RoleSkill"("roleId", "requirementType");

-- CreateIndex
CREATE UNIQUE INDEX "RoleSkill_roleId_name_key" ON "RoleSkill"("roleId", "name");

-- CreateIndex
CREATE INDEX "JobSource_enabled_type_idx" ON "JobSource"("enabled", "type");

-- CreateIndex
CREATE UNIQUE INDEX "JobSource_name_type_key" ON "JobSource"("name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Job_canonicalUrl_key" ON "Job"("canonicalUrl");

-- CreateIndex
CREATE INDEX "Job_listingStatus_createdAt_idx" ON "Job"("listingStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Job_title_company_idx" ON "Job"("title", "company");

-- CreateIndex
CREATE INDEX "Job_postedAt_idx" ON "Job"("postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_sourceId_externalId_key" ON "Job"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "JobMatch_roleId_score_idx" ON "JobMatch"("roleId", "score");

-- CreateIndex
CREATE INDEX "JobMatch_roleId_meetsThreshold_evaluatedAt_idx" ON "JobMatch"("roleId", "meetsThreshold", "evaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobMatch_jobId_roleId_scoringVersion_key" ON "JobMatch"("jobId", "roleId", "scoringVersion");

-- CreateIndex
CREATE INDEX "ReviewBatch_profileId_status_createdAt_idx" ON "ReviewBatch"("profileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewBatchItem_batchId_decision_idx" ON "ReviewBatchItem"("batchId", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewBatchItem_batchId_jobMatchId_key" ON "ReviewBatchItem"("batchId", "jobMatchId");

-- CreateIndex
CREATE INDEX "Application_profileId_status_updatedAt_idx" ON "Application"("profileId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Application_targetRoleId_status_idx" ON "Application"("targetRoleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_profileId_jobId_key" ON "Application"("profileId", "jobId");

-- CreateIndex
CREATE INDEX "ResumeVersion_applicationId_createdAt_idx" ON "ResumeVersion"("applicationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeVersion_applicationId_version_key" ON "ResumeVersion"("applicationId", "version");

-- CreateIndex
CREATE INDEX "SyncRun_status_startedAt_idx" ON "SyncRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_sourceId_startedAt_idx" ON "SyncRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "TargetRole" ADD CONSTRAINT "TargetRole_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleSkill" ADD CONSTRAINT "RoleSkill_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TargetRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "JobSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TargetRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewBatch" ADD CONSTRAINT "ReviewBatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewBatchItem" ADD CONSTRAINT "ReviewBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ReviewBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewBatchItem" ADD CONSTRAINT "ReviewBatchItem_jobMatchId_fkey" FOREIGN KEY ("jobMatchId") REFERENCES "JobMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewBatchItem" ADD CONSTRAINT "ReviewBatchItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "TargetRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "JobSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
