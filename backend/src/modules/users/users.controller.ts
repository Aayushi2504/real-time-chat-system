import { Request, Response, NextFunction } from 'express';
import * as svc from './users.service';
import { ok } from '../../utils/apiResponse';

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.validatedQuery?.q ?? '');
    const limit = Number(req.validatedQuery?.limit ?? 20);
    const rows = await svc.searchUsers(req.userId!, q, limit);
    return ok(res, rows);
  } catch (e) {
    next(e);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Number(req.validatedQuery?.limit ?? 50);
    const rows = await svc.listUsers(req.userId!, limit);
    return ok(res, rows);
  } catch (e) {
    next(e);
  }
}
