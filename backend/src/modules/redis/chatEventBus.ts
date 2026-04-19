import type { Server } from 'socket.io';
import { getRedis, getRedisSubscriber } from './redisClient';
import { logger } from '../../utils/logger';

export const CHAT_FANOUT_CHANNEL = 'chat:fanout:v1';

export type FanoutEnvelope = {
  event: string;
  room: string;
  payload: unknown;
};

let ioRef: Server | null = null;

export function attachSocketServer(io: Server) {
  ioRef = io;
}

export async function publishFanout(envelope: FanoutEnvelope): Promise<void> {
  const r = getRedis();
  await r.publish(CHAT_FANOUT_CHANNEL, JSON.stringify(envelope));
}

export function startFanoutSubscriber(): void {
  const sub = getRedisSubscriber();

  sub.on('message', (channel, message) => {
    if (channel !== CHAT_FANOUT_CHANNEL) {
      return;
    }
    try {
      const env = JSON.parse(message) as FanoutEnvelope;
      if (!ioRef) {
        return;
      }
      ioRef.to(env.room).emit(env.event, env.payload);
    } catch (e) {
      logger.error({ e, message }, 'fanout parse/dispatch failed');
    }
  });

  sub
    .subscribe(CHAT_FANOUT_CHANNEL)
    .then(() => logger.info({ channel: CHAT_FANOUT_CHANNEL }, 'subscribed to chat fanout'))
    .catch((err) => logger.error({ err }, 'failed to subscribe fanout channel'));
}
