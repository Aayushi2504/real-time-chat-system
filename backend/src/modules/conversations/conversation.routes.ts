import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { validateBody, validateQuery } from '../../middlewares/validate';
import * as ctrl from './conversation.controller';
import { addParticipantSchema, createConversationSchema } from './conversation.validation';
import { messagesQuerySchema } from '../messages/message.validation';

const r = Router();
r.use(authMiddleware);

r.post('/', validateBody(createConversationSchema), ctrl.create);
r.get('/', ctrl.list);
r.get('/:id/messages', validateQuery(messagesQuerySchema), ctrl.listMessages);
r.get('/:id', ctrl.getById);
r.post('/:id/participants', validateBody(addParticipantSchema), ctrl.addParticipant);
r.delete('/:id/participants/:userId', ctrl.removeParticipant);

export default r;
