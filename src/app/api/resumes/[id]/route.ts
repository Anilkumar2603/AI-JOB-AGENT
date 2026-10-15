import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";



type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;

    // Matches the existing single-profile prototype.
    // Replace this with the authenticated user's profile before public launch.
    const profile = await prisma.candidateProfile.findFirst();

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 404 },
      );
    }

    const resume = await prisma.uploadedResume.findFirst({
      where: {
        id,
        profileId: profile.id,
      },
    });

    if (!resume) {
      return NextResponse.json(
        { error: "Resume not found." },
        { status: 404 },
      );
    }

    await r2.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: resume.storageKey,
      }),
    );

    await prisma.uploadedResume.delete({
      where: { id: resume.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resume deletion failed:", error);

    return NextResponse.json(
      { error: "Unable to delete resume." },
      { status: 500 },
    );
  }
}