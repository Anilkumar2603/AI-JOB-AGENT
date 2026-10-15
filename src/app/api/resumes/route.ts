import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import pdf from "pdf-parse";

import { prisma } from "@/lib/prisma";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";


const MAX_FILE_SIZE = 8 * 1024 * 1024;

function safeFilename(name: string) {
  return name
    .replace(/[\/\\]/g, "_")
    .replace(/[^\w.\- ()]/g, "_")
    .slice(0, 150) || "resume.pdf";
}

export async function GET() {
  try {
    // Matches the current single-profile API behavior.
    // Replace with the authenticated user's profile before public launch.
    const profile = await prisma.candidateProfile.findFirst();

    if (!profile) {
      return NextResponse.json({ resumes: [] });
    }

    const resumes = await prisma.uploadedResume.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        extractedText: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ resumes });
  } catch (error) {
    console.error("Resume list failed:", error);

    return NextResponse.json(
      { error: "Unable to load resumes." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let storageKey: string | undefined;
  let uploadedToR2 = false;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose a PDF resume to upload." },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "The PDF must be between 1 byte and 8 MB." },
        { status: 400 },
      );
    }

    const profile = await prisma.candidateProfile.findFirst();

    if (!profile) {
      return NextResponse.json(
        { error: "Save your candidate profile before uploading a resume." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Check the actual file signature rather than trusting its extension.
    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      buffer.length < 5 ||
      buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      return NextResponse.json(
        { error: "Only valid PDF files are supported." },
        { status: 400 },
      );
    }

    let extractedText = "";

    try {
      const parsed = await pdf(buffer);
      extractedText = parsed.text.trim();
    } catch {
      return NextResponse.json(
        { error: "The PDF could not be read. Try another PDF file." },
        { status: 422 },
      );
    }

    if (!extractedText) {
      return NextResponse.json(
        {
          error:
            "No selectable text was found. This PDF may be scanned; OCR support is not enabled yet.",
        },
        { status: 422 },
      );
    }

    const originalName = safeFilename(file.name);

    storageKey =
      `profiles/${profile.id}/resumes/${randomUUID()}.pdf`;

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: storageKey,
        Body: buffer,
        ContentType: "application/pdf",
        ContentLength: buffer.length,
        Metadata: {
          profileid: profile.id,
        },
      }),
    );

    uploadedToR2 = true;

    const resume = await prisma.uploadedResume.create({
      data: {
        profileId: profile.id,
        originalName,
        mimeType: "application/pdf",
        sizeBytes: buffer.length,
        storageKey,
        extractedText,
        status: "READY",
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        extractedText: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ resume }, { status: 201 });
  } catch (error) {
    console.error("Resume upload failed:", error);

    // Best-effort cleanup if the database write failed after the R2 upload.
    if (uploadedToR2 && storageKey) {
      try {
        await r2.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: storageKey,
          }),
        );
      } catch (cleanupError) {
        console.error("Resume storage cleanup failed:", cleanupError);
      }
    }

    return NextResponse.json(
      { error: "Resume upload failed. Please try again." },
      { status: 500 },
    );
  }
}