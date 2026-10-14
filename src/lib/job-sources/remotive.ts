
import { createHash } from "node:crypto";
import {
  EmploymentType,
  JobListingStatus,
  JobSourceType,
  Prisma,
  SyncStatus,
  SyncTrigger,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const API_URL = "https://remotive.com/api/remote-jobs";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_JOBS = 100;

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  description: string;
  job_type?: string;
  publication_date?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function parseRemotiveJob(value: unknown): RemotiveJob | null {
  if (!isObject(value)) return null;

  const id = value.id;
  const url = nonEmptyString(value.url);
  const title = nonEmptyString(value.title);
  const company = nonEmptyString(value.company_name);
  const description = nonEmptyString(value.description);

  if (
    typeof id !== "number" ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !url ||
    !title ||
    !company ||
    !description
  ) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "remotive.com"
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    id,
    url,
    title,
    company_name: company,
    candidate_required_location:
      nonEmptyString(value.candidate_required_location) ?? "Unspecified",
    description,
    job_type: nonEmptyString(value.job_type) ?? undefined,
    publication_date:
      nonEmptyString(value.publication_date) ?? undefined,
  };
}

function employmentType(value?: string): EmploymentType {
  switch (value?.toLowerCase()) {
    case "full_time":
      return EmploymentType.FULL_TIME;
    case "part_time":
      return EmploymentType.PART_TIME;
    case "contract":
    case "freelance":
      return EmploymentType.CONTRACT;
    case "internship":
      return EmploymentType.INTERNSHIP;
    default:
      return EmploymentType.UNKNOWN;
  }
}

function validDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function contentHash(job: RemotiveJob): string {
  return createHash("sha256")
    .update(`${job.title}\n${job.company_name}\n${job.description}`)
    .digest("hex");
}

function configString(
  config: Prisma.JsonValue | null,
  key: string,
): string | undefined {
  if (!isObject(config)) return undefined;
  return nonEmptyString(config[key]) ?? undefined;
}

function configLimit(config: Prisma.JsonValue | null): number {
  if (!isObject(config)) return MAX_JOBS;
  const value = config.limit;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return MAX_JOBS;
  }

  return Math.max(1, Math.min(MAX_JOBS, Math.floor(value)));
}

export async function syncRemotiveSource(sourceId: string) {
  const source = await prisma.jobSource.findUnique({
    where: { id: sourceId },
  });

  if (!source) throw new Error("Job source not found.");
  if (!source.enabled) throw new Error("Job source is disabled.");
  if (source.type !== JobSourceType.PUBLIC_API) {
    throw new Error("This source is not configured as a public API.");
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      sourceId: source.id,
      trigger: SyncTrigger.MANUAL,
      status: SyncStatus.RUNNING,
    },
  });

  let jobsFound = 0;
  let jobsCreated = 0;
  let jobsUpdated = 0;
  let invalidJobs = 0;

  try {
    const url = new URL(API_URL);
    url.searchParams.set("limit", String(configLimit(source.config)));

    const category = configString(source.config, "category");
    const search = configString(source.config, "search");

    if (category) url.searchParams.set("category", category);
    if (search) url.searchParams.set("search", search);

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Remotive API returned HTTP ${response.status}.`);
    }

    const body: unknown = await response.json();

    if (!isObject(body) || !Array.isArray(body.jobs)) {
      throw new Error("Remotive returned an unexpected response.");
    }

    jobsFound = body.jobs.length;

    for (const rawJob of body.jobs) {
      const job = parseRemotiveJob(rawJob);

      if (!job) {
        invalidJobs++;
        continue;
      }

      const existing = await prisma.job.findUnique({
        where: { canonicalUrl: job.url },
        select: { id: true },
      });

      await prisma.job.upsert({
        where: { canonicalUrl: job.url },
        create: {
          sourceId: source.id,
          externalId: String(job.id),
          canonicalUrl: job.url,
          title: job.title,
          company: job.company_name,
          location: job.candidate_required_location ?? "Unspecified",
          description: job.description,
          employmentType: employmentType(job.job_type),
          remote: true,
          salaryCurrency: "USD",
          listingStatus: JobListingStatus.ACTIVE,
          postedAt: validDate(job.publication_date),
          lastSeenAt: new Date(),
          contentHash: contentHash(job),
        },
        update: {
          title: job.title,
          company: job.company_name,
          location: job.candidate_required_location ?? "Unspecified",
          description: job.description,
          employmentType: employmentType(job.job_type),
          remote: true,
          listingStatus: JobListingStatus.ACTIVE,
          postedAt: validDate(job.publication_date),
          lastSeenAt: new Date(),
          contentHash: contentHash(job),
        },
      });

      if (existing) jobsUpdated++;
      else jobsCreated++;
    }

    const status =
      invalidJobs > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCEEDED;

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status,
        finishedAt: new Date(),
        jobsFound,
        jobsCreated,
        jobsUpdated,
        errorSummary:
          invalidJobs > 0
            ? `${invalidJobs} invalid listing(s) were skipped.`
            : null,
        stats: {
          provider: "Remotive",
          invalidJobs,
          attributionRequired: true,
        },
      },
    });

    return {
      syncRunId: syncRun.id,
      sourceId: source.id,
      provider: "Remotive",
      jobsFound,
      jobsCreated,
      jobsUpdated,
      invalidJobs,
      status,
    };
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: SyncStatus.FAILED,
        finishedAt: new Date(),
        jobsFound,
        jobsCreated,
        jobsUpdated,
        errorSummary:
          error instanceof Error
            ? error.message.slice(0, 2000)
            : "Unknown source sync error.",
      },
    });

    throw error;
  }
}
