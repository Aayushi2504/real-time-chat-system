import type { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: { id: string; email: string; name: string };
      validatedQuery?: Record<string, unknown>;
    }
  }
}

export type AuthTokenPayload = JwtPayload & { sub: string; email: string };
