
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  RoleStatus,
  RemotePreference,
  SkillRequirement,
} from "@/generated/prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const remotePreferences = Object.values(RemotePreference);

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const role = await prisma.targetRole.findUnique({
      where: { id },
      include: { skills: true },
    });

    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ role });
  } catch (error) {
    console.error("Failed to fetch role:", error);
    return NextResponse.json(
      { error: "Failed to fetch role" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.targetRole.findUnique({
      where: { id },
      include: { skills: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    const data: Prisma.TargetRoleUpdateInput = {};

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim()
      ) {
        return NextResponse.json(
          { error: "Role name cannot be empty" },
          { status: 400 }
        );
      }

      data.name = body.name.trim();
    }

    if (body.alternativeTitles !== undefined) {
      if (
        !Array.isArray(body.alternativeTitles) ||
        !body.alternativeTitles.every(
          (value: unknown) => typeof value === "string"
        )
      ) {
        return NextResponse.json(
          { error: "alternativeTitles must be an array of strings" },
          { status: 400 }
        );
      }

      data.alternativeTitles = body.alternativeTitles;
    }

    if (body.locations !== undefined) {
      if (
        !Array.isArray(body.locations) ||
        !body.locations.every(
          (value: unknown) => typeof value === "string"
        )
      ) {
        return NextResponse.json(
          { error: "locations must be an array of strings" },
          { status: 400 }
        );
      }

      data.locations = body.locations;
    }

    if (body.status !== undefined) {
      if (!Object.values(RoleStatus).includes(body.status)) {
        return NextResponse.json(
          { error: "Invalid role status" },
          { status: 400 }
        );
      }

      data.status = body.status;
      data.archivedAt =
        body.status === RoleStatus.ARCHIVED ? new Date() : null;
    }

    if (body.remotePreference !== undefined) {
      if (!remotePreferences.includes(body.remotePreference)) {
        return NextResponse.json(
          { error: "Invalid remote preference" },
          { status: 400 }
        );
      }

      data.remotePreference = body.remotePreference;
    }

    for (const field of [
      "minExperienceMonths",
      "maxExperienceMonths",
      "minSalaryAnnual",
      "maxSalaryAnnual",
    ] as const) {
      if (body[field] !== undefined) {
        const value = body[field];

        if (
          value !== null &&
          (!Number.isSafeInteger(value) || value < 0)
        ) {
          return NextResponse.json(
            { error: `${field} must be a non-negative integer or null` },
            { status: 400 }
          );
        }

        data[field] = value;
      }
    }

    if (body.minFitScore !== undefined) {
      if (
        !Number.isInteger(body.minFitScore) ||
        body.minFitScore < 0 ||
        body.minFitScore > 100
      ) {
        return NextResponse.json(
          { error: "minFitScore must be between 0 and 100" },
          { status: 400 }
        );
      }

      data.minFitScore = body.minFitScore;
    }

    if (
      body.minExperienceMonths !== undefined &&
      body.minExperienceMonths !== null &&
      body.maxExperienceMonths !== undefined &&
      body.maxExperienceMonths !== null &&
      body.minExperienceMonths > body.maxExperienceMonths
    ) {
      return NextResponse.json(
        { error: "Minimum experience cannot exceed maximum experience" },
        { status: 400 }
      );
    }

    if (
      body.minSalaryAnnual !== undefined &&
      body.minSalaryAnnual !== null &&
      body.maxSalaryAnnual !== undefined &&
      body.maxSalaryAnnual !== null &&
      body.minSalaryAnnual > body.maxSalaryAnnual
    ) {
      return NextResponse.json(
        { error: "Minimum salary cannot exceed maximum salary" },
        { status: 400 }
      );
    }

    const role = await prisma.$transaction(async (tx) => {
      if (body.skills !== undefined) {
        if (
          !Array.isArray(body.skills) ||
          !body.skills.every(
            (skill: unknown) =>
              typeof skill === "string" && skill.trim().length > 0
          )
        ) {
          throw new Error("INVALID_SKILLS");
        }

        const skills = [
          ...new Set(
            (body.skills as string[]).map((skill) => skill.trim())
          ),
        ];

        await tx.roleSkill.deleteMany({
          where: { roleId: id },
        });

        if (skills.length) {
          await tx.roleSkill.createMany({
            data: skills.map((name) => ({
              roleId: id,
              name,
              requirementType: SkillRequirement.REQUIRED,
            })),
          });
        }
      }

      return tx.targetRole.update({
        where: { id },
        data,
        include: { skills: true },
      });
    });

    return NextResponse.json({ role });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_SKILLS") {
      return NextResponse.json(
        { error: "Skills must be non-empty strings" },
        { status: 400 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A role with this name already exists in your profile" },
        { status: 409 }
      );
    }

    console.error("Failed to update role:", error);
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const existing = await prisma.targetRole.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    const role = await prisma.targetRole.update({
      where: { id },
      data: {
        status: RoleStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Role archived successfully",
      role,
    });
  } catch (error) {
    console.error("Failed to archive role:", error);
    return NextResponse.json(
      { error: "Failed to archive role" },
      { status: 500 }
    );
  }
}
