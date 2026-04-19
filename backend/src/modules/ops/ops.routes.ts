import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import * as ctrl from './ops.controller';

const r = Router();

r.get('/health', ctrl.health);
r.get('/metrics', authMiddleware, ctrl.metrics);
r.get('/dlq', authMiddleware, ctrl.listDlq);

export default r;
