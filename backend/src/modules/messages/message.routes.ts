import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { validateBody } from '../../middlewares/validate';
import * as ctrl from './message.controller';
import { sendMessageSchema } from './message.validation';

const r = Router();
r.use(authMiddleware);
r.post('/', validateBody(sendMessageSchema), ctrl.send);
r.patch('/:id/delivered', ctrl.markDelivered);
r.patch('/:id/read', ctrl.markRead);

export default r;
