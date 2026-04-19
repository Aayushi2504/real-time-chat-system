import { Router } from 'express';
import { validateBody } from '../../middlewares/validate';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { authRateLimiter } from '../../middlewares/rateLimiter';
import * as ctrl from './auth.controller';
import { loginSchema, registerSchema } from './auth.validation';

const r = Router();

r.post('/register', authRateLimiter, validateBody(registerSchema), ctrl.register);
r.post('/login', authRateLimiter, validateBody(loginSchema), ctrl.login);
r.get('/me', authMiddleware, ctrl.me);

export default r;
