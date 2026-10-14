
import { NextResponse } from "next/server";
import { JobSourceType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueueTask } from "@/lib/task-queue";



export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const source = await prisma.jobSource.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        enabled: true,
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Job source not found." },
        { status: 404 },
      );
    }

    if (!source.enabled) {
      return NextResponse.json(
        { error: "This job source is disabled." },
        { status: 409 },
      );
    }

    if (
      source.type !== JobSourceType.PUBLIC_API ||
      source.name.trim().toLowerCase() !== "remotive"
    ) {
      return NextResponse.json(
        { error: "This sync endpoint currently supports Remotive only." },
        { status: 400 },
      );
    }

    const activeTask = await prisma.backgroundTask.findFirst({
      where: {
        type: "SYNC_SOURCE",
        status: {
          in: ["QUEUED", "RUNNING", "RETRY_WAIT"],
        },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, payload: true, status: true },
    });

    if (
      activeTask &&
      typeof activeTask.payload === "object" &&
      activeTask.payload !== null &&
      !Array.isArray(activeTask.payload) &&
      "sourceId" in activeTask.payload &&
      activeTask.payload.sourceId === source.id
    ) {
      return NextResponse.json(
        { task: activeTask, alreadyQueued: true },
        { status: 200 },
      );
    }

    const task = await enqueueTask({
      type: "SYNC_SOURCE",
      payload: { sourceId: source.id },
      maxAttempts: 1,
    });

    return NextResponse.json(
      {
        task: { id: task.id, status: task.status },
        source: source.name,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("Could not queue source sync:", error);

    return NextResponse.json(
      { error: "Could not start source synchronization." },
      { status: 500 },
    );
  }
}
