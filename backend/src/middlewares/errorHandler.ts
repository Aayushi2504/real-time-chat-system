import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { fail } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return fail(res, err.statusCode, err.message, err.errors);
  }
  if (err instanceof ZodError) {
    return fail(res, 400, 'Validation failed', err.issues);
  }
  logger.error({ err }, 'unhandled error');
  const message =
    env.NODE_ENV === 'production' ? 'Internal server error' : (err as Error).message;
  return fail(res, 500, message);
}
