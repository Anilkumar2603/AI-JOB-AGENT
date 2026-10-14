
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET() {
  try {
    const profile = await prisma.candidateProfile.findFirst({
      include: {
        targetRoles: {
          include: {
            skills: true,
          },
        },
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Failed to fetch profile:", error);

    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const {
      fullName,
      email,
      phone,
      location,
      summary,
      skills,
      experience,
      projects,
      education,
      preferences,
    } = body;

    if (
      typeof fullName !== "string" ||
      !fullName.trim() ||
      typeof email !== "string" ||
      !email.trim()
    ) {
      return NextResponse.json(
        { error: "Full name and email are required" },
        { status: 400 }
      );
    }

    const profileData = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ?? null,
      location: location ?? null,
      summary: summary ?? "",
      skills: Array.isArray(skills) ? skills : [],
      experience: experience ?? [],
      projects: projects ?? [],
      education: education ?? [],
      preferences: preferences ?? {},
    };

    const existing = await prisma.candidateProfile.findFirst();

    const profile = existing
      ? await prisma.candidateProfile.update({
          where: { id: existing.id },
          data: profileData,
        })
      : await prisma.candidateProfile.create({
          data: profileData,
        });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Failed to save profile:", error);

    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 }
    );
  }
}
