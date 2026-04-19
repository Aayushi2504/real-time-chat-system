import { Request, Response, NextFunction } from 'express';
import * as svc from './message.service';
import { ok } from '../../utils/apiResponse';

export async function send(req: Request, res: Response, next: NextFunction) {
  try {
    const msg = await svc.sendMessage({
      userId: req.userId!,
      conversationId: req.body.conversationId,
      content: req.body.content,
      type: req.body.type,
    });
    return ok(res, msg, 'Sent', 201);
  } catch (e) {
    next(e);
  }
}

export async function listByConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.validatedQuery as { cursor?: string; limit?: number };
    const result = await svc.listMessagesPaginated({
      userId: req.userId!,
      conversationId: req.params.id,
      cursor: q.cursor,
      limit: q.limit ?? 50,
    });
    return ok(res, result);
  } catch (e) {
    next(e);
  }
}

export async function markDelivered(req: Request, res: Response, next: NextFunction) {
  try {
    const msg = await svc.markDelivered(req.userId!, req.params.id);
    return ok(res, msg);
  } catch (e) {
    next(e);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    const msg = await svc.markRead(req.userId!, req.params.id);
    return ok(res, msg);
  } catch (e) {
    next(e);
  }
}
