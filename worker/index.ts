import "dotenv/config";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { POST as runMatchingRoute } from "@/app/api/matching/run/route";
import { syncRemotiveSource } from "@/lib/job-sources/remotive";
import {
  claimTask,
  completeTask,
  failTask,
  recoverStaleTasks,
  type ClaimedTask,
  WORKER_ID,
} from "@/lib/task-queue";

type TaskHandler = (
  task: ClaimedTask,
) => Promise<Prisma.InputJsonValue>;

const handlers: Record<string, TaskHandler> = {
  SYSTEM_HEALTH_CHECK: async () => {
    await prisma.$queryRaw`SELECT 1`;

    return {
      healthy: true,
      checkedAt: new Date().toISOString(),
      workerId: WORKER_ID,
    };
  },
  
RUN_MATCHING: async () => {
  const response = await runMatchingRoute();

  const result: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Job matching failed.";

    throw new Error(message);
  }

  if (
    typeof result !== "object" ||
    result === null ||
    Array.isArray(result)
  ) {
    throw new Error("Matching returned an invalid response.");
  }

  return result as Prisma.InputJsonObject;
},

SYNC_SOURCE: async (task) => {
  const payload: unknown = task.payload;

  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    !("sourceId" in payload) ||
    typeof payload.sourceId !== "string" ||
    !payload.sourceId.trim()
  ) {
    throw new Error("SYNC_SOURCE requires a valid sourceId.");
  }

  const result = await syncRemotiveSource(payload.sourceId);

  return result as Prisma.InputJsonObject;
},


};

const POLL_INTERVAL_MS = 2000;
const RECOVERY_INTERVAL_MS = 30_000;

let stopping = false;
let lastRecoveryAt = 0;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function executeTask(task: ClaimedTask): Promise<void> {
  const handler = handlers[task.type];

  if (!handler) {
    await failTask(
      {
        ...task,
        attempts: task.maxAttempts,
      },
      new Error(`No handler registered for task type: ${task.type}`),
    );

    console.error(`[worker] Unsupported task type: ${task.type}`);
    return;
  }

  try {
    console.info(
      `[worker] Started ${task.type} (${task.id}), attempt ${task.attempts}/${task.maxAttempts}`,
    );

    const result = await handler(task);
    const completed = await completeTask(task.id, result);

    if (!completed) {
      console.warn(
        `[worker] Could not finalize task ${task.id}; its lease may have changed.`,
      );
      return;
    }

    console.info(`[worker] Completed ${task.type} (${task.id})`);
  } catch (error) {
    const recorded = await failTask(task, error);

    console.error(
      `[worker] Task ${task.id} failed:`,
      error instanceof Error ? error.message : error,
      recorded ? "" : "(task ownership changed before failure was recorded)",
    );
  }
}

async function runWorker(): Promise<void> {
  console.info(`[worker] Starting worker ${WORKER_ID}`);

  await prisma.$queryRaw`SELECT 1`;
  console.info("[worker] PostgreSQL connection verified.");

  while (!stopping) {
    try {
      const now = Date.now();

      if (now - lastRecoveryAt >= RECOVERY_INTERVAL_MS) {
        const recovered = await recoverStaleTasks();
        lastRecoveryAt = Date.now();

        if (recovered > 0) {
          console.warn(`[worker] Recovered ${recovered} stale task(s).`);
        }
      }

      const task = await claimTask();

      if (task) {
        await executeTask(task);
        continue;
      }
    } catch (error) {
      console.error("[worker] Polling cycle failed:", error);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  console.info("[worker] Shutdown requested; closing database connection.");

  await prisma.$disconnect();
  console.info("[worker] Shutdown complete.");
}

function requestShutdown(signal: string): void {
  console.info(`[worker] Received ${signal}.`);
  stopping = true;
}

process.once("SIGINT", () => requestShutdown("SIGINT"));
process.once("SIGTERM", () => requestShutdown("SIGTERM"));

runWorker().catch(async (error) => {
  console.error("[worker] Fatal startup error:", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
