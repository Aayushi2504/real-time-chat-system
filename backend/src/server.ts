import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './lib/prisma';
import { attachSocketServer, startFanoutSubscriber } from './modules/redis/chatEventBus';
import { setSocketServer } from './modules/socket/socketRegistry';
import { registerSocketHandlers } from './modules/socket/socket.handlers';
import { getRedis } from './modules/redis/redisClient';

const app = createApp();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  },
  path: '/socket.io',
});

setSocketServer(io);
attachSocketServer(io);
registerSocketHandlers(io);
startFanoutSubscriber();

getRedis().ping().catch((e) => logger.error({ e }, 'redis ping on boot failed'));

httpServer.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'HTTP + Socket.IO server listening');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  try {
    io.close();
    await prisma.$disconnect();
    httpServer.close(() => process.exit(0));
  } catch (e) {
    logger.error({ e }, 'shutdown error');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
