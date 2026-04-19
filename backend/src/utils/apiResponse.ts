import { Response } from 'express';

export function ok<T>(res: Response, data: T, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function fail(
  res: Response,
  status: number,
  message: string,
  errors?: unknown[],
) {
  return res.status(status).json({ success: false, message, errors: errors ?? [] });
}
