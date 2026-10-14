
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  EligibilityStatus,
  JobListingStatus,
  Prisma,
  SkillRequirement,
} from "@/generated/prisma/client";

const SCORING_VERSION = 3;
const AUTO_APPLY_MIN_SCORE = 85;
const EXPLORE_MIN_SCORE = 55;


function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/c\+\+/g, "cplusplus")
    .replace(/c#/g, "csharp")
    .replace(/\.net/g, " dotnet ")
    .replace(/node\.js/g, " nodejs ")
    .replace(/react\.js/g, " react ")
    .replace(/next\.js/g, " next ")
    .replace(/postgresql/g, " postgres ")
    .replace(/restful\s+apis?/g, " rest api ")
    .replace(/\bapis\b/g, " api ")
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function containsTerm(text: string, term: string): boolean {
  const normalizedText = normalize(text);
  const normalizedTerm = normalize(term);

  if (!normalizedTerm) return false;

  return ` ${normalizedText} `.includes(` ${normalizedTerm} `);
}


function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function getCandidateMonths(experience: Prisma.JsonValue): number | null {
  if (!Array.isArray(experience) || experience.length === 0) {
    return null;
  }

  let totalMonths = 0;
  let foundNumericValue = false;

  for (const entry of experience) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry)
    ) {
      continue;
    }

    const months = getNumber(entry.months);
    const years = getNumber(entry.years);

    if (months !== null && months >= 0) {
      totalMonths += months;
      foundNumericValue = true;
    } else if (years !== null && years >= 0) {
      totalMonths += years * 12;
      foundNumericValue = true;
    }
  }

  return foundNumericValue ? totalMonths : null;
}

function scoreJob(
  job: {
  title: string;
  description: string;
  canonicalUrl: string;
  location: string | null;
  remote: boolean;
  minExperienceMonths: number | null;
  maxExperienceMonths: number | null;
  minSalaryAnnual: number | null;
  maxSalaryAnnual: number | null;
  salaryCurrency: string;
},
  role: {
    name: string;
    alternativeTitles: string[];
    locations: string[];
    remotePreference: string;
    minExperienceMonths: number | null;
    maxExperienceMonths: number | null;
    minSalaryAnnual: number | null;
    maxSalaryAnnual: number | null;
    salaryCurrency: string;
    minFitScore: number;
    skills: {
      name: string;
      requirementType: SkillRequirement;
      weight: number;
    }[];
  },
  candidate: {
    skills: string[];
    experience: Prisma.JsonValue;
  }
) {
  const reasons: string[] = [];
  const jobText = `${job.title} ${job.description}`;
  const candidateMonths = getCandidateMonths(candidate.experience);

  // 1. Title match: 30 points.
  const titleTerms = [role.name, ...role.alternativeTitles].filter(Boolean);
  const titleMatched = titleTerms.some((term) =>
    containsTerm(job.title, term)
  );
  const titlePoints = titleMatched ? 30 : 0;

  reasons.push(
    titleMatched
      ? "Job title matches the target role or an alternative title."
      : "Job title does not directly match the target role or its alternative titles."
  );

  // 2. Skills: 40 points.
  // Candidate skills are matched against the listing text.
  // Listing mentions do not prove that the candidate possesses a skill.
  const requiredSkills = role.skills.filter(
    (skill) => skill.requirementType === SkillRequirement.REQUIRED
  );
  const preferredSkills = role.skills.filter(
    (skill) => skill.requirementType === SkillRequirement.PREFERRED
  );

  const matchedJobSkills = role.skills.filter((skill) =>
    containsTerm(jobText, skill.name)
  );

  const candidateMatchedSkills = role.skills
    .filter((skill) =>
      candidate.skills.some((item) => containsTerm(item, skill.name))
    )
    .map((skill) => skill.name);

  const missingRequiredSkills = requiredSkills
    .filter(
      (skill) =>
        !candidate.skills.some((item) => containsTerm(item, skill.name))
    )
    .map((skill) => skill.name);

  const allSkillWeight = role.skills.reduce(
    (sum, skill) => sum + Math.max(1, skill.weight),
    0
  );

  let skillPoints: number | null = null;

  if (allSkillWeight > 0) {
    const matchedWeight = role.skills
      .filter((skill) =>
        candidate.skills.some((item) => containsTerm(item, skill.name))
      )
      .reduce((sum, skill) => sum + Math.max(1, skill.weight), 0);

    skillPoints = 40 * (matchedWeight / allSkillWeight);

    if (candidateMatchedSkills.length > 0) {
      reasons.push(
        `Candidate profile matches these configured role skills: ${candidateMatchedSkills.join(", ")}.`
      );
    }

    if (missingRequiredSkills.length > 0) {
      reasons.push(
        `Candidate profile does not list these required skills: ${missingRequiredSkills.join(", ")}.`
      );
    } else if (requiredSkills.length > 0) {
      reasons.push("Candidate profile lists all configured required skills.");
    }

    if (matchedJobSkills.length > 0) {
      reasons.push(
        `The job listing mentions: ${matchedJobSkills.map((skill) => skill.name).join(", ")}.`
      );
    } else {
      reasons.push("No configured role skills were found in the job title or description.");
    }
  } else {
    reasons.push("No skills are configured for this target role, so the skill score is unavailable.");
  }

  // 3. Location: 15 points.
  let locationPoints: number | null = null;
  let locationConflict = false;

  const roleLocations = role.locations.map(normalize).filter(Boolean);
  const jobLocation = normalize(job.location ?? "");

  if (
    role.remotePreference === "REMOTE_ONLY" &&
    !job.remote
  ) {
    locationPoints = 0;
    locationConflict = true;
    reasons.push("The role requires remote work, but this listing is not marked remote.");
  } else if (
    job.remote &&
    role.remotePreference !== "ONSITE_OR_HYBRID"
  ) {
    locationPoints = 15;
    reasons.push("Remote work is compatible with the role's location preference.");
  } else if (!job.location) {
    reasons.push("Job location is missing, so location compatibility is unknown.");
  } else if (roleLocations.length === 0) {
    locationPoints = 7.5;
    reasons.push("No target locations are configured; location received a neutral score.");
  } else if (
    roleLocations.some(
      (location) =>
        jobLocation.includes(location) ||
        location.includes(jobLocation)
    )
  ) {
    locationPoints = 15;
    reasons.push("Job location matches a configured target location.");
  } else {
    locationPoints = 0;
    locationConflict = true;
    reasons.push("Job location does not match the configured target locations.");
  }

  // 4. Experience: 15 points.
  // Missing experience data is excluded from scoring, not treated as zero.
  let experiencePoints: number | null = null;
  let experienceConflict = false;

  if (candidateMonths !== null) {
    const minimumRequired =
      job.minExperienceMonths ?? role.minExperienceMonths;
    const maximumAllowed =
      job.maxExperienceMonths ?? role.maxExperienceMonths;

    if (
      minimumRequired !== null &&
      candidateMonths < minimumRequired
    ) {
      experiencePoints = 0;
      experienceConflict = true;
      reasons.push("Candidate experience is below the stated minimum.");
    } else {
      experiencePoints = 15;
      reasons.push("Candidate experience meets the known minimum requirement or no minimum is specified.");
    }

    if (
      maximumAllowed !== null &&
      candidateMonths > maximumAllowed
    ) {
      reasons.push("Candidate experience exceeds the stated maximum; verify whether the employer is flexible.");
    }
  } else {
    reasons.push("Candidate experience is unavailable or cannot be calculated; experience points were excluded.");
  }

  // Calculate the percentage from available components only.
  // Missing information is not automatically scored as zero.
  const components: { points: number; maximum: number }[] = [
    { points: titlePoints, maximum: 30 },
  ];

  if (skillPoints !== null) {
    components.push({ points: skillPoints, maximum: 40 });
  }

  if (locationPoints !== null) {
    components.push({ points: locationPoints, maximum: 15 });
  }

  if (experiencePoints !== null) {
    components.push({ points: experiencePoints, maximum: 15 });
  }

  const availableMaximum = components.reduce(
    (sum, component) => sum + component.maximum,
    0
  );

  const earnedPoints = components.reduce(
    (sum, component) => sum + component.points,
    0
  );

  const score =
    availableMaximum > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((earnedPoints / availableMaximum) * 100))
        )
      : 0;

  // Salary is a separate signal, not part of the score.
  let salaryCompatible: boolean | null = null;

  if (
    role.minSalaryAnnual !== null &&
    job.maxSalaryAnnual !== null &&
    role.salaryCurrency === job.salaryCurrency
  ) {
    salaryCompatible = job.maxSalaryAnnual >= role.minSalaryAnnual;
    reasons.push(
      salaryCompatible
        ? "Job salary maximum may meet the target salary minimum."
        : "Job salary maximum is below the target salary minimum."
    );
  } else {
    reasons.push("Salary compatibility could not be established from the available salary data.");
  }

  const eligibility =
    locationConflict || experienceConflict
      ? EligibilityStatus.INELIGIBLE
      : candidateMonths === null
        ? EligibilityStatus.UNCERTAIN
        : EligibilityStatus.ELIGIBLE;
  const validApplicationUrl = (() => {
    try {
      const url = new URL(job.canonicalUrl);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  })();

  const classification =
    !titleMatched || score < EXPLORE_MIN_SCORE
      ? "NOT_RECOMMENDED"
      : score >= AUTO_APPLY_MIN_SCORE &&
          eligibility === EligibilityStatus.ELIGIBLE &&
          missingRequiredSkills.length === 0 &&
          salaryCompatible !== false &&
          validApplicationUrl
        ? "AUTO_APPLY_CANDIDATE"
        : "REVIEW_REQUIRED";
  return {
    score,
    eligibility,
    meetsThreshold: score >= role.minFitScore,
    matchedSkills: candidateMatchedSkills,
    missingRequiredSkills,
    reasons: {
  items: reasons,
  classification,
      titleMatched,
      jobSkillsFound: matchedJobSkills.map((skill) => skill.name),
      candidateSkillsMatched: candidateMatchedSkills,
      missingRequiredSkills,
      scoreBreakdown: {
        title: { earned: titlePoints, maximum: 30 },
        skills: skillPoints === null
          ? null
          : { earned: Number(skillPoints.toFixed(2)), maximum: 40 },
        location: locationPoints === null
          ? null
          : { earned: locationPoints, maximum: 15 },
        experience: experiencePoints === null
          ? null
          : { earned: experiencePoints, maximum: 15 },
        availableMaximum,
        earnedPoints: Number(earnedPoints.toFixed(2)),
      },
      salaryCompatible,
    } satisfies Prisma.InputJsonObject,
  };
}

export async function POST() {
  try {
    const profile = await prisma.candidateProfile.findFirst({
      include: {
        targetRoles: {
          where: { status: "ACTIVE" },
          include: { skills: true },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Create a candidate profile before running matching." },
        { status: 400 }
      );
    }

    if (profile.targetRoles.length === 0) {
      return NextResponse.json(
        { error: "Create at least one active target role before running matching." },
        { status: 400 }
      );
    }

    const jobs = await prisma.job.findMany({
      where: {
        listingStatus: {
          in: [JobListingStatus.ACTIVE, JobListingStatus.UNKNOWN],
        },
      },
      orderBy: { lastSeenAt: "desc" },
      take: 500,
    });

    let created = 0;
    let updated = 0;

    for (const job of jobs) {
      for (const role of profile.targetRoles) {
        const result = scoreJob(job, role, profile);

        const where = {
          jobId_roleId_scoringVersion: {
            jobId: job.id,
            roleId: role.id,
            scoringVersion: SCORING_VERSION,
          },
        };

        const existing = await prisma.jobMatch.findUnique({
          where,
          select: { id: true },
        });

        await prisma.jobMatch.upsert({
          where,
          create: {
            jobId: job.id,
            roleId: role.id,
            scoringVersion: SCORING_VERSION,
            ...result,
          },
          update: {
            ...result,
            evaluatedAt: new Date(),
          },
        });

        if (existing) updated++;
        else created++;
      }
    }

    return NextResponse.json({
      message: "Job matching completed.",
      jobsEvaluated: jobs.length,
      rolesEvaluated: profile.targetRoles.length,
      matchesCreated: created,
      matchesUpdated: updated,
      scoringVersion: SCORING_VERSION,
    });
  } catch (error) {
    console.error("Job matching failed:", error);

    return NextResponse.json(
      { error: "Job matching failed. Check the server logs for details." },
      { status: 500 }
    );
  }
}
