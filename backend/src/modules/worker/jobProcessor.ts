import type { QueueJob } from '@prisma/client';
import { NotificationStatus, QueueJobStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { JOB_TYPES } from '../queue/queue.types';
import type { ProcessNotificationPayload } from '../queue/queue.types';

function backoffMs(retryCount: number): number {
  return Math.min(1000 * 2 ** retryCount, 60_000);
}

const workerId = env.WORKER_ID ?? `worker-${process.pid}`;

async function handleProcessNotification(p: ProcessNotificationPayload): Promise<void> {
  if (p.forceFail) {
    throw new Error('forced failure for DLQ demo');
  }
  await prisma.notification.update({
    where: { id: p.notificationId },
    data: { status: NotificationStatus.SENT },
  });
}

export async function claimNextJob(): Promise<QueueJob | null> {
  const now = new Date();
  const rows = await prisma.$queryRaw<QueueJob[]>`
    UPDATE "QueueJob" AS q SET
      "status" = 'PROCESSING'::"QueueJobStatus",
      "locked_at" = ${now},
      "locked_by" = ${workerId},
      "updated_at" = ${now}
    FROM (
      SELECT "id" FROM "QueueJob"
      WHERE "status" = 'PENDING'::"QueueJobStatus" AND "available_at" <= ${now}
      ORDER BY "created_at" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ) AS sub
    WHERE q."id" = sub."id"
    RETURNING q.*;
  `;
  return rows[0] ?? null;
}

export async function processClaimedJob(job: QueueJob): Promise<void> {
  try {
    if (job.type === JOB_TYPES.PROCESS_NOTIFICATION) {
      await handleProcessNotification(job.payload as unknown as ProcessNotificationPayload);
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }
    await prisma.queueJob.update({
      where: { id: job.id },
      data: {
        status: QueueJobStatus.COMPLETED,
        lastError: null,
        lockedAt: null,
        lockedBy: null,
      },
    });
    logger.info({ jobId: job.id, type: job.type }, 'queue job completed');
  } catch (e) {
    const errMsg = (e as Error).message;
    const nextRetry = job.retryCount + 1;
    logger.warn(
      { jobId: job.id, attempt: nextRetry, err: errMsg },
      'queue job processing failed',
    );
    if (nextRetry > job.maxRetries) {
      await prisma.$transaction([
        prisma.deadLetterJob.create({
          data: {
            originalJobId: job.id,
            type: job.type,
            payload: job.payload as object,
            error: errMsg,
            retryCount: job.retryCount,
          },
        }),
        prisma.queueJob.update({
          where: { id: job.id },
          data: {
            status: QueueJobStatus.FAILED,
            lastError: errMsg,
            retryCount: nextRetry,
            lockedAt: null,
            lockedBy: null,
          },
        }),
      ]);
      logger.error({ jobId: job.id, retries: job.retryCount }, 'queue job moved to DLQ');
    } else {
      const delay = backoffMs(job.retryCount);
      const availableAt = new Date(Date.now() + delay);
      await prisma.queueJob.update({
        where: { id: job.id },
        data: {
          status: QueueJobStatus.PENDING,
          retryCount: nextRetry,
          lastError: errMsg,
          availableAt,
          lockedAt: null,
          lockedBy: null,
        },
      });
      logger.info(
        { jobId: job.id, nextRetryAt: availableAt.toISOString(), delayMs: delay },
        'queue job scheduled for retry',
      );
    }
  }
}

export async function runJobCycle(): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) {
    return false;
  }
  await processClaimedJob(job);
  return true;
}
