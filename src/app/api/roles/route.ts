
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getProfileId(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

// GET /api/roles — list target roles
export async function GET() {
  try {
    const profile = await prisma.candidateProfile.findFirst({
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ roles: [] });
    }

    const roles = await prisma.targetRole.findMany({
      where: { profileId: profile.id },
      include: { skills: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ roles });
  } catch (error) {
    console.error("Failed to fetch roles:", error);
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}

// POST /api/roles — create a target role
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Role name is required" },
        { status: 400 }
      );
    }

    const profileId = getProfileId(body.profileId);

    // For development, use the existing profile when no ID is supplied.
    const profile = profileId
      ? await prisma.candidateProfile.findUnique({
          where: { id: profileId },
          select: { id: true },
        })
      : await prisma.candidateProfile.findFirst({
          select: { id: true },
        });

    if (!profile) {
      return NextResponse.json(
        { error: "Create a candidate profile first" },
        { status: 400 }
      );
    }

    const skills = Array.isArray(body.skills)
      ? body.skills
          .filter(
            (skill: unknown) =>
              typeof skill === "string" && skill.trim()
          )
          .map((skill: string) => ({
            name: skill.trim(),
            requirementType: "REQUIRED" as const,
          }))
      : [];

    const role = await prisma.targetRole.create({
      data: {
        profileId: profile.id,
        name,
        alternativeTitles: Array.isArray(body.alternativeTitles)
          ? body.alternativeTitles.filter(
              (title: unknown) => typeof title === "string"
            )
          : [],
        locations: Array.isArray(body.locations)
          ? body.locations.filter(
              (location: unknown) => typeof location === "string"
            )
          : ["India"],
        remotePreference: [
          "ANY",
          "REMOTE_ONLY",
          "ONSITE_OR_HYBRID",
        ].includes(body.remotePreference)
          ? body.remotePreference
          : "ANY",
        minExperienceMonths:
          Number.isInteger(body.minExperienceMonths) &&
          body.minExperienceMonths >= 0
            ? body.minExperienceMonths
            : null,
        maxExperienceMonths:
          Number.isInteger(body.maxExperienceMonths) &&
          body.maxExperienceMonths >= 0
            ? body.maxExperienceMonths
            : null,
        minSalaryAnnual:
          Number.isInteger(body.minSalaryAnnual) &&
          body.minSalaryAnnual >= 0
            ? body.minSalaryAnnual
            : null,
        maxSalaryAnnual:
          Number.isInteger(body.maxSalaryAnnual) &&
          body.maxSalaryAnnual >= 0
            ? body.maxSalaryAnnual
            : null,
        minFitScore:
          Number.isInteger(body.minFitScore) &&
          body.minFitScore >= 0 &&
          body.minFitScore <= 100
            ? body.minFitScore
            : 60,
        skills: { create: skills },
      },
      include: { skills: true },
    });

    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    console.error("Failed to create role:", error);

    return NextResponse.json(
      { error: "Failed to create role. Check for duplicate role names." },
      { status: 500 }
    );
  }
}
