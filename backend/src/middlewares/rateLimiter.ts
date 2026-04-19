import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many requests', errors: [] },
  standardHeaders: true,
  legacyHeaders: false,
});
