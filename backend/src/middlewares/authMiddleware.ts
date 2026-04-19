import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { UnauthorizedError } from '../utils/errors';

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing bearer token'));
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; email: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return next(new UnauthorizedError('User not found'));
    }
    req.userId = user.id;
    req.user = user;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; email: string };
    req.userId = decoded.sub;
    req.user = { id: decoded.sub, email: decoded.email, name: '' };
  } catch {
    /* ignore */
  }
  next();
}
