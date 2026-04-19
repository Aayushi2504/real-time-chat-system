import Redis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

let client: Redis | null = null;
let subscriber: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        logger.warn({ times, delay }, 'redis retry');
        return delay;
      },
    });
    client.on('error', (err) => logger.error({ err }, 'redis client error'));
    client.on('connect', () => logger.info('redis connected'));
  }
  return client;
}

export function getRedisSubscriber(): Redis {
  if (!subscriber) {
    subscriber = getRedis().duplicate();
    subscriber.on('error', (err) => logger.error({ err }, 'redis subscriber error'));
  }
  return subscriber;
}

export async function disconnectRedis(): Promise<void> {
  await Promise.all([
    client?.quit().catch(() => undefined),
    subscriber?.quit().catch(() => undefined),
  ]);
  client = null;
  subscriber = null;
}
