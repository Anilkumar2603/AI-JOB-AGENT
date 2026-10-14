
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  JobSourceType,
  Prisma,
} from "@/generated/prisma/client";

const allowedTypes = Object.values(JobSourceType);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function containsSecretKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsSecretKey);
  }

  if (!isPlainObject(value)) {
    return false;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (
      /api.?key|secret|password|token|authorization|credential/i.test(key)
    ) {
      return true;
    }

    if (containsSecretKey(nestedValue)) {
      return true;
    }
  }

  return false;
}

export async function GET() {
  try {
    const sources = await prisma.jobSource.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        enabled: true,
        attribution: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ sources });
  } catch (error) {
    console.error("Failed to fetch job sources:", error);

    return NextResponse.json(
      { error: "Failed to fetch job sources." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!isPlainObject(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const type =
      typeof body.type === "string" ? body.type : "";

    if (!name || name.length > 100) {
      return NextResponse.json(
        { error: "Name is required and must be at most 100 characters." },
        { status: 400 }
      );
    }

    if (!allowedTypes.includes(type as JobSourceType)) {
      return NextResponse.json(
        {
          error: "Invalid source type.",
          allowedTypes,
        },
        { status: 400 }
      );
    }

    if (
      body.enabled !== undefined &&
      typeof body.enabled !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Enabled must be a boolean." },
        { status: 400 }
      );
    }

    if (
      body.attribution !== undefined &&
      body.attribution !== null &&
      typeof body.attribution !== "string"
    ) {
      return NextResponse.json(
        { error: "Attribution must be a string or null." },
        { status: 400 }
      );
    }

    if (
      body.attribution !== undefined &&
      typeof body.attribution === "string" &&
      body.attribution.length > 300
    ) {
      return NextResponse.json(
        { error: "Attribution must be at most 300 characters." },
        { status: 400 }
      );
    }

    const config = body.config ?? {};

    if (!isPlainObject(config)) {
      return NextResponse.json(
        { error: "Config must be a JSON object." },
        { status: 400 }
      );
    }

    if (containsSecretKey(config)) {
      return NextResponse.json(
        {
          error:
            "Do not store API keys, tokens, passwords, or other secrets in source config.",
        },
        { status: 400 }
      );
    }

    const source = await prisma.jobSource.create({
      data: {
        name,
        type: type as JobSourceType,
        enabled: body.enabled === undefined ? true : body.enabled,
        attribution:
          typeof body.attribution === "string"
            ? body.attribution.trim() || null
            : null,
        config: config as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        name: true,
        type: true,
        enabled: true,
        attribution: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    if (
      error instanceof SyntaxError
    ) {
      return NextResponse.json(
        { error: "Request body contains invalid JSON." },
        { status: 400 }
      );
    }

    console.error("Failed to create job source:", error);

    return NextResponse.json(
      { error: "Failed to create job source." },
      { status: 500 }
    );
  }
}
