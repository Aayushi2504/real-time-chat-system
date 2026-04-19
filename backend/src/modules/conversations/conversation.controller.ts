import { Request, Response, NextFunction } from 'express';
import * as svc from './conversation.service';
import { ok } from '../../utils/apiResponse';
import * as messageSvc from '../messages/message.service';
import { ValidationError } from '../../utils/errors';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      type: 'DIRECT' | 'GROUP';
      participantId?: string;
      name?: string;
      participantIds?: string[];
    };
    if (body.type === 'DIRECT' && body.participantId) {
      const conv = await svc.createOrGetDirect(req.userId!, body.participantId);
      return ok(res, conv, 'Conversation ready', 201);
    }
    if (body.type === 'GROUP' && body.name && body.participantIds) {
      const conv = await svc.createGroup(req.userId!, {
        name: body.name,
        participantIds: body.participantIds,
      });
      return ok(res, conv, 'Group created', 201);
    }
    throw new ValidationError('Invalid conversation request');
  } catch (e) {
    next(e);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await svc.listConversations(req.userId!);
    return ok(res, rows);
  } catch (e) {
    next(e);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.getConversation(req.userId!, req.params.id);
    return ok(res, row);
  } catch (e) {
    next(e);
  }
}

export async function addParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.addParticipant(
      req.userId!,
      req.params.id,
      req.body.userId,
    );
    return ok(res, result);
  } catch (e) {
    next(e);
  }
}

export async function removeParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.removeParticipant(
      req.userId!,
      req.params.id,
      req.params.userId,
    );
    return ok(res, result);
  } catch (e) {
    next(e);
  }
}

export async function listMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.validatedQuery as { cursor?: string; limit?: number };
    const result = await messageSvc.listMessagesPaginated({
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
