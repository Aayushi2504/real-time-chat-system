import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ok } from '../../utils/apiResponse';
import { getRedis } from '../redis/redisClient';

export function health(_req: Request, res: Response) {
  return ok(res, { status: 'ok', ts: new Date().toISOString() });
}

export async function metrics(_req: Request, res: Response) {
  const [users, conversations, messages, pendingJobs, dlq] = await Promise.all([
    prisma.user.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.queueJob.count({ where: { status: 'PENDING' } }),
    prisma.deadLetterJob.count(),
  ]);
  let redisPing = 'unknown';
  try {
    const p = await getRedis().ping();
    redisPing = p;
  } catch {
    redisPing = 'error';
  }
  return ok(res, {
    users,
    conversations,
    messages,
    pendingQueueJobs: pendingJobs,
    deadLetterJobs: dlq,
    redis: redisPing,
  });
}

export async function listDlq(_req: Request, res: Response) {
  const rows = await prisma.deadLetterJob.findMany({
    orderBy: { failedAt: 'desc' },
    take: 100,
  });
  return ok(res, rows);
}
