import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      return next(r.error);
    }
    req.body = r.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.query);
    if (!r.success) {
      return next(r.error);
    }
    req.validatedQuery = r.data as Record<string, unknown>;
    next();
  };
}
