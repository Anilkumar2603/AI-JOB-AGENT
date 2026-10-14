
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { enqueueTask } from "../src/lib/task-queue";

async function main() {
  const task = await enqueueTask({
    type: "RUN_MATCHING",
    payload: {},
    maxAttempts: 3,
  });

  console.log("Matching task enqueued:", task.id);

  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const current = await prisma.backgroundTask.findUnique({
      where: { id: task.id },
      select: {
        status: true,
        attempts: true,
        result: true,
        lastError: true,
      },
    });

    console.log(current);

    if (
      current?.status === "SUCCEEDED" ||
      current?.status === "FAILED"
    ) {
      break;
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
