
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  EmploymentType,
  JobListingStatus,
  Prisma,
} from "@/generated/prisma/client";

const employmentTypes = Object.values(EmploymentType);
const listingStatuses = Object.values(JobListingStatus);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(
  value: unknown,
  field: string,
  maxLength = 500
): string | null {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new Error(`${field} must be a string of at most ${maxLength} characters.`);
  }

  return value.trim() || null;
}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === "") return null;

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(`${field} must be a non-negative integer.`);
  }

  return value;
}

function optionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value !== "string") {
    throw new Error(`${field} must be a valid date string.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid date string.`);
  }

  return date;
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("canonicalUrl is required.");
  }

  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("canonicalUrl must be a valid URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("canonicalUrl must use HTTP or HTTPS.");
  }

  url.hash = "";

  return url.toString();
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const requestedLimit = Number(params.get("limit") ?? "50");
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 50;

    const status = params.get("status");

    if (
      status &&
      !listingStatuses.includes(status as JobListingStatus)
    ) {
      return NextResponse.json(
        { error: "Invalid listing status.", allowedStatuses: listingStatuses },
        { status: 400 }
      );
    }

    const jobs = await prisma.job.findMany({
      where: status
        ? { listingStatus: status as JobListingStatus }
        : undefined,
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        source: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return NextResponse.json({ jobs, count: jobs.length });
  } catch (error) {
    console.error("Failed to fetch jobs:", error);

    return NextResponse.json(
      { error: "Failed to fetch jobs." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!isObject(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    if (
      typeof body.sourceId !== "string" ||
      !body.sourceId.trim()
    ) {
      return NextResponse.json(
        { error: "sourceId is required." },
        { status: 400 }
      );
    }

    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.trim().length > 300
    ) {
      return NextResponse.json(
        { error: "title is required and must be at most 300 characters." },
        { status: 400 }
      );
    }

    if (
      typeof body.company !== "string" ||
      !body.company.trim() ||
      body.company.trim().length > 200
    ) {
      return NextResponse.json(
        { error: "company is required and must be at most 200 characters." },
        { status: 400 }
      );
    }

    if (
      typeof body.description !== "string" ||
      !body.description.trim() ||
      body.description.length > 100_000
    ) {
      return NextResponse.json(
        { error: "description is required and must be at most 100,000 characters." },
        { status: 400 }
      );
    }

    const canonicalUrl = normalizeUrl(body.canonicalUrl);

    const externalId = optionalString(body.externalId, "externalId", 300);
    const location = optionalString(body.location, "location", 300);
    const salaryCurrency =
      optionalString(body.salaryCurrency, "salaryCurrency", 10) ?? "INR";

    if (!/^[A-Z]{3}$/.test(salaryCurrency)) {
      return NextResponse.json(
        { error: "salaryCurrency must be a 3-letter uppercase currency code, such as INR." },
        { status: 400 }
      );
    }

    const employmentType =
      body.employmentType === undefined
        ? EmploymentType.UNKNOWN
        : body.employmentType;

    const listingStatus =
      body.listingStatus === undefined
        ? JobListingStatus.ACTIVE
        : body.listingStatus;

    if (
      typeof employmentType !== "string" ||
      !employmentTypes.includes(employmentType as EmploymentType)
    ) {
      return NextResponse.json(
        { error: "Invalid employmentType.", allowedTypes: employmentTypes },
        { status: 400 }
      );
    }

    if (
      typeof listingStatus !== "string" ||
      !listingStatuses.includes(listingStatus as JobListingStatus)
    ) {
      return NextResponse.json(
        { error: "Invalid listingStatus.", allowedStatuses: listingStatuses },
        { status: 400 }
      );
    }

    if (body.remote !== undefined && typeof body.remote !== "boolean") {
      return NextResponse.json(
        { error: "remote must be a boolean." },
        { status: 400 }
      );
    }

    const minExperienceMonths = optionalNumber(
      body.minExperienceMonths,
      "minExperienceMonths"
    );
    const maxExperienceMonths = optionalNumber(
      body.maxExperienceMonths,
      "maxExperienceMonths"
    );
    const minSalaryAnnual = optionalNumber(
      body.minSalaryAnnual,
      "minSalaryAnnual"
    );
    const maxSalaryAnnual = optionalNumber(
      body.maxSalaryAnnual,
      "maxSalaryAnnual"
    );

    if (
      minExperienceMonths !== null &&
      maxExperienceMonths !== null &&
      minExperienceMonths > maxExperienceMonths
    ) {
      throw new Error("Minimum experience cannot exceed maximum experience.");
    }

    if (
      minSalaryAnnual !== null &&
      maxSalaryAnnual !== null &&
      minSalaryAnnual > maxSalaryAnnual
    ) {
      throw new Error("Minimum salary cannot exceed maximum salary.");
    }

    const postedAt = optionalDate(body.postedAt, "postedAt");
    const expiresAt = optionalDate(body.expiresAt, "expiresAt");

    const source = await prisma.jobSource.findUnique({
      where: { id: body.sourceId.trim() },
      select: { id: true, enabled: true },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Job source not found." },
        { status: 404 }
      );
    }

    if (!source.enabled) {
      return NextResponse.json(
        { error: "This job source is disabled." },
        { status: 409 }
      );
    }

    const existing = await prisma.job.findFirst({
      where: {
        OR: [
          { canonicalUrl },
          ...(externalId
            ? [{ sourceId: source.id, externalId }]
            : []),
        ],
      },
    });

    if (
      existing &&
      existing.sourceId !== source.id &&
      existing.canonicalUrl === canonicalUrl
    ) {
      return NextResponse.json(
        {
          error:
            "This job URL already belongs to another source. Use the existing listing rather than creating a duplicate.",
          existingJobId: existing.id,
        },
        { status: 409 }
      );
    }

    const data = {
      sourceId: source.id,
      externalId,
      canonicalUrl,
      title: body.title.trim(),
      company: body.company.trim(),
      location,
      description: body.description.trim(),
      employmentType: employmentType as EmploymentType,
      remote: body.remote === true,
      minExperienceMonths,
      maxExperienceMonths,
      minSalaryAnnual,
      maxSalaryAnnual,
      salaryCurrency,
      listingStatus: listingStatus as JobListingStatus,
      postedAt,
      expiresAt,
      lastSeenAt: new Date(),
    };

    const job = existing
      ? await prisma.job.update({
          where: { id: existing.id },
          data,
          include: {
            source: {
              select: { id: true, name: true, type: true },
            },
          },
        })
      : await prisma.job.create({
          data,
          include: {
            source: {
              select: { id: true, name: true, type: true },
            },
          },
        });

    await prisma.auditEvent.create({
      data: {
        eventType: existing ? "JOB_UPDATED" : "JOB_CREATED",
        entityType: "Job",
        entityId: job.id,
        metadata: {
          sourceId: source.id,
          canonicalUrl,
        } satisfies Prisma.InputJsonObject,
      },
    });

    return NextResponse.json(
      {
        job,
        action: existing ? "updated" : "created",
      },
      { status: existing ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body contains invalid JSON." },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      const validationMessages = [
        "canonicalUrl",
        "sourceId",
        "externalId",
        "location",
        "salaryCurrency",
        "employmentType",
        "listingStatus",
        "remote",
        "minExperienceMonths",
        "maxExperienceMonths",
        "minSalaryAnnual",
        "maxSalaryAnnual",
        "postedAt",
        "expiresAt",
        "Minimum experience",
        "Minimum salary",
      ];

      if (
        validationMessages.some((message) =>
          error.message.includes(message)
        )
      ) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A duplicate job listing was detected. Fetch jobs and retry if needed." },
        { status: 409 }
      );
    }

    console.error("Failed to ingest job:", error);

    return NextResponse.json(
      { error: "Failed to save job listing." },
      { status: 500 }
    );
  }
}
