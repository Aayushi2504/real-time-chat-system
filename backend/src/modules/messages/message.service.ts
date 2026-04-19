import {
  MessageStatus,
  MessageType,
  ConversationType,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import { publishFanout } from '../redis/chatEventBus';
import { dispatchMessageSideEffects } from '../notifications/notificationPipeline.service';
import { decodeMessageCursor, encodeMessageCursor } from './message.utils';
import { logger } from '../../utils/logger';

const previewMax = 200;

export async function assertConversationMember(userId: string, conversationId: string) {
  const p = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId },
  });
  if (!p) {
    throw new ForbiddenError('Not a member of this conversation');
  }
  return p;
}

export async function sendMessage(input: {
  userId: string;
  conversationId: string;
  content: string;
  type?: MessageType;
  metadata?: object | null;
}) {
  await assertConversationMember(input.userId, input.conversationId);

  const conv = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { type: true },
  });
  if (!conv) {
    throw new NotFoundError('Conversation not found');
  }

  const sender = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { name: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.userId,
        content: input.content,
        type: input.type ?? MessageType.TEXT,
        status: MessageStatus.SENT,
        metadata: input.metadata ?? undefined,
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    await tx.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });

    await tx.conversationParticipant.updateMany({
      where: {
        conversationId: input.conversationId,
        userId: { not: input.userId },
      },
      data: { unreadCount: { increment: 1 } },
    });

    return msg;
  });

  const payload = {
    message: {
      id: result.id,
      conversationId: result.conversationId,
      senderId: result.senderId,
      content: result.content,
      type: result.type,
      status: result.status,
      createdAt: result.createdAt,
      sender: result.sender,
    },
  };

  /** Every member must receive `message:new` even when not in `conversation:*` (only the open thread is joined). */
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: input.conversationId },
    select: { userId: true },
  });
  await Promise.all(
    participants.map((p) =>
      publishFanout({
        event: 'message:new',
        room: `user:${p.userId}`,
        payload,
      }),
    ),
  );

  const preview =
    input.content.length > previewMax
      ? `${input.content.slice(0, previewMax)}…`
      : input.content;

  void dispatchMessageSideEffects({
    conversationId: input.conversationId,
    senderId: input.userId,
    senderName: sender?.name ?? 'Someone',
    content: input.content,
    messageId: result.id,
    conversationType: conv.type,
    preview,
  }).catch((err) => logger.error({ err }, 'dispatchMessageSideEffects failed'));

  return result;
}

export async function listMessagesPaginated(input: {
  userId: string;
  conversationId: string;
  cursor?: string | undefined;
  limit: number;
}) {
  await assertConversationMember(input.userId, input.conversationId);
  const take = Math.min(Math.max(input.limit, 1), 100);
  const cursor = input.cursor ? decodeMessageCursor(input.cursor) : null;

  const where = {
    conversationId: input.conversationId,
    deletedAt: null,
    ...(cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            {
              AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }],
            },
          ],
        }
      : {}),
  };

  const rows = await prisma.message.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    include: {
      sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  const hasMore = rows.length > take;
  const slice = hasMore ? rows.slice(0, take) : rows;
  const chronological = [...slice].reverse();

  let nextCursor: string | null = null;
  if (hasMore && slice.length > 0) {
    const oldest = slice[slice.length - 1];
    nextCursor = encodeMessageCursor({ createdAt: oldest.createdAt, id: oldest.id });
  }

  return { messages: chronological, nextCursor, hasMore };
}

export async function markDelivered(userId: string, messageId: string) {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { include: { participants: true } } },
  });
  if (!msg) {
    throw new NotFoundError('Message not found');
  }
  const member = msg.conversation.participants.find((p) => p.userId === userId);
  if (!member || userId === msg.senderId) {
    throw new ForbiddenError('Cannot update delivery for this message');
  }
  if (msg.status === MessageStatus.READ) {
    return msg;
  }
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      status: MessageStatus.DELIVERED,
      deliveredAt: new Date(),
    },
    include: { sender: { select: { id: true, name: true } } },
  });

  await publishFanout({
    event: 'message:delivered',
    room: `conversation:${msg.conversationId}`,
    payload: {
      messageId,
      conversationId: msg.conversationId,
      userId,
      deliveredAt: updated.deliveredAt,
      status: updated.status,
    },
  });

  return updated;
}

export async function markRead(userId: string, messageId: string) {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { include: { participants: true } } },
  });
  if (!msg) {
    throw new NotFoundError('Message not found');
  }
  const member = msg.conversation.participants.find((p) => p.userId === userId);
  if (!member || userId === msg.senderId) {
    throw new ForbiddenError('Cannot mark read for this message');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.message.update({
      where: { id: messageId },
      data: {
        status: MessageStatus.READ,
        readAt: new Date(),
        deliveredAt: msg.deliveredAt ?? new Date(),
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    await tx.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: msg.conversationId,
          userId,
        },
      },
      data: {
        lastReadMessageId: messageId,
        unreadCount: 0,
      },
    });

    return m;
  });

  await publishFanout({
    event: 'message:read',
    room: `conversation:${msg.conversationId}`,
    payload: {
      messageId,
      conversationId: msg.conversationId,
      userId,
      readAt: updated.readAt,
      status: updated.status,
    },
  });

  await publishFanout({
    event: 'conversation:updated',
    room: `user:${userId}`,
    payload: { conversationId: msg.conversationId, unreadCount: 0 },
  });

  return updated;
}
