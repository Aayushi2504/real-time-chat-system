import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import {
  addUserSession,
  joinConversationRoom,
  leaveConversationRoom,
  removeUserSession,
} from '../redis/presence.service';
import { publishFanout } from '../redis/chatEventBus';
import * as messageService from '../messages/message.service';

type AuthedSocket = Socket & { userId: string };

export function registerSocketHandlers(io: Server): void {
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth as { token?: string })?.token ||
        (socket.handshake.headers.authorization as string | undefined)?.replace(
          /^Bearer\s+/i,
          '',
        );
      if (!token) {
        return next(new Error('Unauthorized'));
      }
      const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
      if (!user) {
        return next(new Error('Unauthorized'));
      }
      (socket as AuthedSocket).userId = user.id;
      next();
    } catch (e) {
      logger.warn({ e }, 'socket auth failed');
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const s = socket as AuthedSocket;
    const userId = s.userId;

    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: true, lastSeenAt: new Date() },
    });
    await addUserSession(userId);
    s.join(`user:${userId}`);

    const memberships = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    for (const m of memberships) {
      await publishFanout({
        event: 'user:online',
        room: `conversation:${m.conversationId}`,
        payload: { userId },
      });
    }

    logger.info({ userId, socketId: s.id }, 'socket connected');

    s.on('conversation:join', async (payload: { conversationId: string }, ack) => {
      try {
        await messageService.assertConversationMember(userId, payload.conversationId);
        s.join(`conversation:${payload.conversationId}`);
        await joinConversationRoom(userId, payload.conversationId);
        ack?.({ ok: true });
      } catch (e) {
        logger.warn({ e, userId }, 'conversation:join failed');
        ack?.({ ok: false, error: (e as Error).message });
        s.emit('error:event', { message: (e as Error).message });
      }
    });

    s.on('conversation:leave', async (payload: { conversationId: string }) => {
      s.leave(`conversation:${payload.conversationId}`);
      await leaveConversationRoom(userId, payload.conversationId);
    });

    s.on(
      'message:send',
      async (
        payload: { conversationId: string; content: string },
        ack?: (r: unknown) => void,
      ) => {
        try {
          const msg = await messageService.sendMessage({
            userId,
            conversationId: payload.conversationId,
            content: payload.content,
          });
          ack?.({ ok: true, message: msg });
        } catch (e) {
          logger.warn({ e, userId }, 'message:send failed');
          ack?.({ ok: false, error: (e as Error).message });
          s.emit('error:event', { message: (e as Error).message });
        }
      },
    );

    s.on('message:delivered', async (payload: { messageId: string }) => {
      try {
        await messageService.markDelivered(userId, payload.messageId);
      } catch (e) {
        logger.warn({ e }, 'message:delivered failed');
      }
    });

    s.on('message:read', async (payload: { messageId: string }) => {
      try {
        await messageService.markRead(userId, payload.messageId);
      } catch (e) {
        logger.warn({ e }, 'message:read failed');
      }
    });

    s.on(
      'typing:start',
      async (payload: { conversationId: string; userName?: string; senderId?: string }) => {
        const u = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        await publishFanout({
          event: 'typing:start',
          room: `conversation:${payload.conversationId}`,
          payload: {
            conversationId: payload.conversationId,
            /** Who is typing — always the authenticated socket user (do not trust client senderId) */
            userId,
            senderId: userId,
            userName: payload.userName ?? u?.name,
          },
        });
      },
    );

    s.on('typing:stop', async (payload: { conversationId: string }) => {
      await publishFanout({
        event: 'typing:stop',
        room: `conversation:${payload.conversationId}`,
        payload: { conversationId: payload.conversationId, userId, senderId: userId },
      });
    });

    s.on('presence:update', async () => {
      await addUserSession(userId);
      await prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      });
    });

    s.on('disconnect', async () => {
      try {
        const remaining = await removeUserSession(userId);
        if (remaining <= 0) {
          await prisma.user.update({
            where: { id: userId },
            data: { isOnline: false, lastSeenAt: new Date() },
          });
        }
        const mems = await prisma.conversationParticipant.findMany({
          where: { userId },
          select: { conversationId: true },
        });
        for (const m of mems) {
          await publishFanout({
            event: 'user:offline',
            room: `conversation:${m.conversationId}`,
            payload: { userId },
          });
        }
        logger.info({ userId, socketId: s.id }, 'socket disconnected');
      } catch (e) {
        logger.error({ e, userId }, 'disconnect cleanup failed');
      }
    });
  });
}
