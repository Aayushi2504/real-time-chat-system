import dotenv from 'dotenv';
dotenv.config();

import { env } from './config/env';
import { logger } from './utils/logger';
import { runJobCycle } from './modules/worker/jobProcessor';
import { prisma } from './lib/prisma';

async function loop() {
  for (;;) {
    try {
      const ran = await runJobCycle();
      if (!ran) {
        await new Promise((r) => setTimeout(r, env.WORKER_POLL_INTERVAL_MS));
      }
    } catch (e) {
      logger.error({ e }, 'worker loop error');
      await new Promise((r) => setTimeout(r, env.WORKER_POLL_INTERVAL_MS));
    }
  }
}

logger.info({ workerPollMs: env.WORKER_POLL_INTERVAL_MS }, 'notification worker starting');
loop().catch((e) => {
  logger.error({ e }, 'worker fatal');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
