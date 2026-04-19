import { Request, Response, NextFunction } from 'express';
import { NotificationType } from '@prisma/client';
import * as svc from './notification.service';
import { ok } from '../../utils/apiResponse';
import { getQueueProvider } from '../queue/getQueueProvider';
import { JOB_TYPES } from '../queue/queue.types';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await svc.listNotifications(req.userId!);
    return ok(res, rows);
  } catch (e) {
    next(e);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    const n = await svc.markNotificationRead(req.userId!, req.params.id);
    return ok(res, n);
  } catch (e) {
    next(e);
  }
}

export async function testFailure(req: Request, res: Response, next: NextFunction) {
  try {
    const forceFail = (req.body as { forceFail?: boolean }).forceFail !== false;
    const n = await svc.createNotification({
      userId: req.userId!,
      type: NotificationType.NEW_MESSAGE,
      title: 'DLQ test',
      body: 'This job is designed to fail processing',
      data: { test: true },
    });
    const jobId = await getQueueProvider().enqueue(JOB_TYPES.PROCESS_NOTIFICATION, {
      notificationId: n.id,
      forceFail,
    });
    return ok(res, { notificationId: n.id, jobId }, 'Enqueued failing job', 201);
  } catch (e) {
    next(e);
  }
}
