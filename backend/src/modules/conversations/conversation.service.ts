import {
  ConversationType,
  ParticipantRole,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors';
import { notifyAddedToGroup } from '../notifications/notificationPipeline.service';
import { publishFanout } from '../redis/chatEventBus';

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function createOrGetDirect(userId: string, otherUserId: string) {
  if (userId === otherUserId) {
    throw new ValidationError('Cannot chat with yourself');
  }
  const other = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!other) {
    throw new NotFoundError('User not found');
  }

  const [low, high] = orderedPair(userId, otherUserId);
  const existing = await prisma.directConversationKey.findUnique({
    where: { userIdLow_userIdHigh: { userIdLow: low, userIdHigh: high } },
    include: { conversation: true },
  });
  if (existing) {
    return existing.conversation;
  }

  return prisma.$transaction(async (tx) => {
    const conv = await tx.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        createdBy: userId,
        participants: {
          create: [
            { userId, role: ParticipantRole.MEMBER },
            { userId: otherUserId, role: ParticipantRole.MEMBER },
          ],
        },
        directKey: {
          create: { userIdLow: low, userIdHigh: high },
        },
      },
    });
    return conv;
  });
}

export async function createGroup(
  userId: string,
  input: { name: string; participantIds: string[] },
) {
  const ids = [...new Set([userId, ...input.participantIds])];
  if (ids.length < 2) {
    throw new ValidationError('Group needs at least two members');
  }
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  if (users.length !== ids.length) {
    throw new NotFoundError('One or more users not found');
  }

  return prisma.conversation.create({
    data: {
      type: ConversationType.GROUP,
      name: input.name,
      createdBy: userId,
      participants: {
        create: ids.map((id) => ({
          userId: id,
          role: id === userId ? ParticipantRole.ADMIN : ParticipantRole.MEMBER,
        })),
      },
    },
  });
}

export async function listConversations(userId: string) {
  const rows = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              isOnline: true,
              lastSeenAt: true,
            },
          },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sender: { select: { id: true, name: true } },
        },
      },
    },
  });

  return rows.map((c) => {
    const me = c.participants.find((p) => p.userId === userId);
    const latest = c.messages[0];
    let title = c.name;
    if (c.type === ConversationType.DIRECT) {
      const other = c.participants.find((p) => p.userId !== userId);
      title = other?.user.name ?? 'Direct';
    }
    return {
      id: c.id,
      type: c.type,
      name: c.name,
      title,
      updatedAt: c.updatedAt,
      unreadCount: me?.unreadCount ?? 0,
      lastReadMessageId: me?.lastReadMessageId,
      participants: c.participants.map((p) => ({
        userId: p.userId,
        role: p.role,
        user: p.user,
      })),
      latestMessage: latest
        ? {
            id: latest.id,
            content: latest.content,
            createdAt: latest.createdAt,
            senderId: latest.senderId,
            sender: latest.sender,
          }
        : null,
    };
  });
}

export async function getConversation(userId: string, conversationId: string) {
  const c = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId } },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              isOnline: true,
              lastSeenAt: true,
            },
          },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });
  if (!c) {
    throw new NotFoundError('Conversation not found');
  }
  const me = c.participants.find((p) => p.userId === userId);
  const latest = c.messages[0];
  let title = c.name;
  if (c.type === ConversationType.DIRECT) {
    const other = c.participants.find((p) => p.userId !== userId);
    title = other?.user.name ?? 'Direct';
  }
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    title,
    createdBy: c.createdBy,
    updatedAt: c.updatedAt,
    unreadCount: me?.unreadCount ?? 0,
    participants: c.participants.map((p) => ({
      userId: p.userId,
      role: p.role,
      user: p.user,
    })),
    latestMessage: latest
      ? {
          id: latest.id,
          content: latest.content,
          createdAt: latest.createdAt,
          senderId: latest.senderId,
          sender: latest.sender,
        }
      : null,
  };
}

export async function addParticipant(
  actorId: string,
  conversationId: string,
  targetUserId: string,
) {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, type: ConversationType.GROUP },
    include: { participants: true },
  });
  if (!conv) {
    throw new NotFoundError('Group conversation not found');
  }
  const actor = conv.participants.find((p) => p.userId === actorId);
  if (!actor || actor.role !== ParticipantRole.ADMIN) {
    throw new ForbiddenError('Only admins can add members');
  }
  if (conv.participants.some((p) => p.userId === targetUserId)) {
    throw new ConflictError('User already in group');
  }
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw new NotFoundError('User not found');
  }

  await prisma.conversationParticipant.create({
    data: {
      conversationId,
      userId: targetUserId,
      role: ParticipantRole.MEMBER,
    },
  });

  const actorUser = await prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true },
  });

  await notifyAddedToGroup({
    conversationId,
    conversationName: conv.name ?? 'Group',
    actorName: actorUser?.name ?? 'Someone',
    targetUserId,
  });

  await publishFanout({
    event: 'conversation:updated',
    room: `conversation:${conversationId}`,
    payload: { conversationId, action: 'participant_added', userId: targetUserId },
  });

  return { ok: true };
}

export async function removeParticipant(
  actorId: string,
  conversationId: string,
  targetUserId: string,
) {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, type: ConversationType.GROUP },
    include: { participants: true },
  });
  if (!conv) {
    throw new NotFoundError('Group conversation not found');
  }
  const actor = conv.participants.find((p) => p.userId === actorId);
  if (!actor || actor.role !== ParticipantRole.ADMIN) {
    throw new ForbiddenError('Only admins can remove members');
  }
  if (targetUserId === actorId) {
    throw new ValidationError('Use leave flow to remove yourself');
  }
  await prisma.conversationParticipant.deleteMany({
    where: { conversationId, userId: targetUserId },
  });

  await publishFanout({
    event: 'conversation:updated',
    room: `conversation:${conversationId}`,
    payload: { conversationId, action: 'participant_removed', userId: targetUserId },
  });

  return { ok: true };
}
