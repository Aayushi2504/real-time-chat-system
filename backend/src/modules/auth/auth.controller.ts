import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { ok } from '../../utils/apiResponse';
import { NotFoundError } from '../../utils/errors';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.registerUser(req.body);
    return ok(res, result, 'Registered', 201);
  } catch (e) {
    next(e);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.loginUser(req.body.email, req.body.password);
    return ok(res, result, 'Logged in');
  } catch (e) {
    next(e);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.userId!);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return ok(res, user);
  } catch (e) {
    next(e);
  }
}
