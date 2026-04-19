import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import type { QueueProvider, EnqueueOptions } from './QueueProvider';
import type { JobType } from './queue.types';
import { QueueJobStatus } from '@prisma/client';

export class LocalQueueProvider implements QueueProvider {
  readonly name = 'local-db';

  async enqueue(type: JobType, payload: unknown, options?: EnqueueOptions): Promise<string> {
    const delayMs = options?.delayMs ?? 0;
    const availableAt = new Date(Date.now() + delayMs);
    const job = await prisma.queueJob.create({
      data: {
        type,
        payload: payload as object,
        status: QueueJobStatus.PENDING,
        maxRetries: options?.maxRetries ?? env.MAX_QUEUE_RETRIES,
        availableAt,
      },
    });
    return job.id;
  }
}
