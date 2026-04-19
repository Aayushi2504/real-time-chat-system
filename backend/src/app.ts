import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { logger } from './utils/logger';
import { errorHandler } from './middlewares/errorHandler';
import { env } from './config/env';
import { openApiDocument } from './openApiDocument';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import conversationRoutes from './modules/conversations/conversation.routes';
import messageRoutes from './modules/messages/message.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import opsRoutes from './modules/ops/ops.routes';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: true,
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) {
          return 'error';
        }
        if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
    }),
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api', opsRoutes);

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use(errorHandler);
  return app;
}
