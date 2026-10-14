
import { NextRequest, NextResponse } from "next/server";
import { TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueueTask } from "@/lib/task-queue";



export async function POST() {
  try {
    const existing = await prisma.backgroundTask.findFirst({
      where: {
        type: "RUN_MATCHING",
        status: {
          in: [
            TaskStatus.QUEUED,
            TaskStatus.RUNNING,
            TaskStatus.RETRY_WAIT,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });

    if (existing) {
      return NextResponse.json(
        { task: existing, alreadyRunning: true },
        { status: 200 },
      );
    }

    const task = await enqueueTask({
      type: "RUN_MATCHING",
      payload: {},
      maxAttempts: 3,
    });

    return NextResponse.json(
      {
        task: { id: task.id, status: task.status },
        alreadyRunning: false,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("Could not enqueue matching task:", error);

    return NextResponse.json(
      { error: "Could not start job matching." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json(
      { error: "taskId is required." },
      { status: 400 },
    );
  }

  try {
    const task = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        type: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        result: true,
        lastError: true,
        createdAt: true,
        finishedAt: true,
      },
    });

    if (!task || task.type !== "RUN_MATCHING") {
      return NextResponse.json(
        { error: "Matching task not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Could not retrieve matching task:", error);

    return NextResponse.json(
      { error: "Could not retrieve task status." },
      { status: 500 },
    );
  }
}
