import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { validateQuery } from '../../middlewares/validate';
import * as ctrl from './users.controller';
import { listQuerySchema, searchQuerySchema } from './users.validation';

const r = Router();
r.use(authMiddleware);

r.get('/search', validateQuery(searchQuerySchema), ctrl.search);
r.get('/', validateQuery(listQuerySchema), ctrl.list);

export default r;
