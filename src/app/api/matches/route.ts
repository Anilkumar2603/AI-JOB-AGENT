
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  EligibilityStatus,
  JobListingStatus,
} from "@/generated/prisma/client";
const SCORING_VERSION = 3;
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const requestedLimit = Number(params.get("limit") ?? "50");
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 50;

    const minScoreParam = params.get("minScore");
    const minScore = minScoreParam === null ? null : Number(minScoreParam);

    if (
      minScore !== null &&
      (!Number.isInteger(minScore) || minScore < 0 || minScore > 100)
    ) {
      return NextResponse.json(
        { error: "minScore must be an integer between 0 and 100." },
        { status: 400 }
      );
    }

    const roleId = params.get("roleId");
    const eligibilityParam = params.get("eligibility");

    if (
      eligibilityParam &&
      !Object.values(EligibilityStatus).includes(
        eligibilityParam as EligibilityStatus
      )
    ) {
      return NextResponse.json(
        {
          error: "Invalid eligibility value.",
          allowedValues: Object.values(EligibilityStatus),
        },
        { status: 400 }
      );
    }

    const profile = await prisma.candidateProfile.findFirst({
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({
        matches: [],
        count: 0,
        message: "Create a candidate profile to view job matches.",
      });
    }

    const matches = await prisma.jobMatch.findMany({
      where: {
        scoringVersion: SCORING_VERSION,
        role: {
          profileId: profile.id,
          status: "ACTIVE",
          ...(roleId ? { id: roleId } : {}),
        },
        ...(minScore !== null ? { score: { gte: minScore } } : {}),
        ...(eligibilityParam
          ? { eligibility: eligibilityParam as EligibilityStatus }
          : {}),
        job: {
          listingStatus: {
            in: [JobListingStatus.ACTIVE, JobListingStatus.UNKNOWN],
          },
        },
      },
      orderBy: [{ score: "desc" }, { evaluatedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        score: true,
        eligibility: true,
        meetsThreshold: true,
        matchedSkills: true,
        missingRequiredSkills: true,
        reasons: true,
        evaluatedAt: true,
        scoringVersion: true,
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            canonicalUrl: true,
            description: true,
            employmentType: true,
            remote: true,
            minExperienceMonths: true,
            maxExperienceMonths: true,
            minSalaryAnnual: true,
            maxSalaryAnnual: true,
            salaryCurrency: true,
            postedAt: true,
            lastSeenAt: true,
            source: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            minFitScore: true,
          },
        },
      },
    });

    const matchesWithClassification = matches.map((match) => {
  const reasons =
    typeof match.reasons === "object" &&
    match.reasons !== null &&
    !Array.isArray(match.reasons)
      ? match.reasons
      : {};

  const classification =
    "classification" in reasons &&
    typeof reasons.classification === "string"
      ? reasons.classification
      : "REVIEW_REQUIRED";

  return {
    ...match,
    classification,
  };
});

    return NextResponse.json({
      matches: matchesWithClassification,
count: matchesWithClassification.length,
      filters: {
        limit,
        minScore,
        roleId,
        eligibility: eligibilityParam,
      },
    });
  } catch (error) {
    console.error("Failed to fetch job matches:", error);

    return NextResponse.json(
      { error: "Failed to fetch job matches." },
      { status: 500 }
    );
  }
}
