
import { randomUUID } from "node:crypto";
import os from "node:os";
import { Prisma, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const WORKER_ID = `${os.hostname()}-${process.pid}-${randomUUID()}`;

const MAX_ERROR_LENGTH = 4000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

export type EnqueueTaskInput = {
  type: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  runAt?: Date;
};

export type ClaimedTask = {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
};

function validateTaskInput(input: EnqueueTaskInput) {
  const type = input.type.trim().toUpperCase();

  if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(type)) {
    throw new Error("Task type must be a valid uppercase identifier.");
  }

  const maxAttempts = input.maxAttempts ?? 5;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new Error("maxAttempts must be an integer between 1 and 10.");
  }

  const payload = input.payload ?? {};

  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error("Task payload must be a JSON object.");
  }

  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 64 * 1024) {
    throw new Error("Task payload must not exceed 64 KB.");
  }

  if (input.runAt && Number.isNaN(input.runAt.getTime())) {
    throw new Error("runAt must be a valid date.");
  }

  return { type, payload, maxAttempts };
}

export async function enqueueTask(input: EnqueueTaskInput) {
  const { type, payload, maxAttempts } = validateTaskInput(input);

  return prisma.backgroundTask.create({
    data: {
      type,
      payload: payload as Prisma.InputJsonValue,
      maxAttempts,
      ...(input.runAt ? { runAt: input.runAt } : {}),
    },
    select: {
      id: true,
      type: true,
      status: true,
      attempts: true,
      maxAttempts: true,
      runAt: true,
      createdAt: true,
    },
  });
}

/**
 * Atomically claims one available task.
 * Concurrent workers may select the same candidate, but only one can
 * successfully perform the conditional update.
 */
export async function claimTask(): Promise<ClaimedTask | null> {
  const now = new Date();

  const candidate = await prisma.backgroundTask.findFirst({
    where: {
      status: { in: [TaskStatus.QUEUED, TaskStatus.RETRY_WAIT] },
      runAt: { lte: now },
    },
    orderBy: [{ runAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  if (!candidate) return null;

  const claim = await prisma.backgroundTask.updateMany({
    where: {
      id: candidate.id,
      status: { in: [TaskStatus.QUEUED, TaskStatus.RETRY_WAIT] },
      runAt: { lte: now },
    },
    data: {
      status: TaskStatus.RUNNING,
      attempts: { increment: 1 },
      lockedAt: now,
      lockedBy: WORKER_ID,
      startedAt: now,
      lastError: null,
    },
  });

  if (claim.count !== 1) return null;

  return prisma.backgroundTask.findUnique({
    where: { id: candidate.id },
    select: {
      id: true,
      type: true,
      payload: true,
      attempts: true,
      maxAttempts: true,
    },
  });
}

/**
 * Records success only if this worker still owns the running task.
 */
export async function completeTask(
  taskId: string,
  result: Prisma.InputJsonValue = {},
) {
  const updated = await prisma.backgroundTask.updateMany({
    where: {
      id: taskId,
      status: TaskStatus.RUNNING,
      lockedBy: WORKER_ID,
    },
    data: {
      status: TaskStatus.SUCCEEDED,
      result,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      finishedAt: new Date(),
    },
  });

  return updated.count === 1;
}

/**
 * Retry failed work with exponential backoff; permanently fail it
 * after maxAttempts has been reached.
 */
export async function failTask(task: ClaimedTask, error: unknown) {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).slice(0, MAX_ERROR_LENGTH);

  const canRetry = task.attempts < task.maxAttempts;

  const delayMs = Math.min(
    1000 * 2 ** Math.max(0, task.attempts - 1),
    MAX_RETRY_DELAY_MS,
  );

  const updated = await prisma.backgroundTask.updateMany({
    where: {
      id: task.id,
      status: TaskStatus.RUNNING,
      lockedBy: WORKER_ID,
    },
    data: canRetry
      ? {
          status: TaskStatus.RETRY_WAIT,
          runAt: new Date(Date.now() + delayMs),
          lockedAt: null,
          lockedBy: null,
          lastError: message,
        }
      : {
          status: TaskStatus.FAILED,
          lockedAt: null,
          lockedBy: null,
          lastError: message,
          finishedAt: new Date(),
        },
  });

  return updated.count === 1;
}

export async function recoverStaleTasks(
  staleAfterMs = 120_000,
  limit = 100,
) {
  const staleBefore = new Date(Date.now() - staleAfterMs);

  const staleTasks = await prisma.backgroundTask.findMany({
    where: {
      status: TaskStatus.RUNNING,
      lockedAt: { lt: staleBefore },
    },
    orderBy: { lockedAt: "asc" },
    take: Math.min(Math.max(limit, 1), 500),
    select: {
      id: true,
      attempts: true,
      maxAttempts: true,
    },
  });

  let recovered = 0;

  for (const task of staleTasks) {
    const retry = task.attempts < task.maxAttempts;

    const result = await prisma.backgroundTask.updateMany({
      where: {
        id: task.id,
        status: TaskStatus.RUNNING,
        lockedAt: { lt: staleBefore },
      },
      data: retry
        ? {
            status: TaskStatus.RETRY_WAIT,
            runAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            lastError: "Worker lease expired; task returned to the queue.",
          }
        : {
            status: TaskStatus.FAILED,
            lockedAt: null,
            lockedBy: null,
            lastError: "Worker lease expired; retry limit reached.",
            finishedAt: new Date(),
          },
    });

    recovered += result.count;
  }

  return recovered;
}

export async function getTaskById(id: string) {
  return prisma.backgroundTask.findUnique({
    where: { id },
  });
}

export async function listTasks(limit = 50) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);

  const [tasks, counts] = await Promise.all([
    prisma.backgroundTask.findMany({
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    }),
    prisma.backgroundTask.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  return {
    tasks,
    counts: Object.fromEntries(
      counts.map(({ status, _count }) => [status, _count._all]),
    ),
  };
}

export { WORKER_ID };
