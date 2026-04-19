import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { validateBody } from '../../middlewares/validate';
import * as ctrl from './notification.controller';
import { testFailureBodySchema } from './notification.validation';

const r = Router();
r.use(authMiddleware);

r.get('/', ctrl.list);
r.patch('/:id/read', ctrl.markRead);
r.post('/test-failure', validateBody(testFailureBodySchema), ctrl.testFailure);

export default r;
