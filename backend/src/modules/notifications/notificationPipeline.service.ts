import { ConversationType, NotificationType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { isUserOnline, isUserInConversationRoom } from '../redis/presence.service';
import { createNotification, emitNotificationSocket } from './notification.service';
import { getQueueProvider } from '../queue/getQueueProvider';
import { JOB_TYPES } from '../queue/queue.types';

function extractMentionedNames(content: string): string[] {
  const re = /@([\w.-]+)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    out.push(m[1].toLowerCase());
  }
  return [...new Set(out)];
}

export async function dispatchMessageSideEffects(input: {
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageId: string;
  conversationType: ConversationType;
  preview: string;
}): Promise<void> {
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: input.conversationId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const queue = getQueueProvider();
  const title = 'New message';

  for (const p of participants) {
    if (p.userId === input.senderId) {
      continue;
    }

    const online = await isUserOnline(p.userId);
    const inRoom = await isUserInConversationRoom(p.userId, input.conversationId);

    if (online && inRoom) {
      continue;
    }

    const body = `${input.senderName}: ${input.preview}`;

    const notification = await createNotification({
      userId: p.userId,
      type: NotificationType.NEW_MESSAGE,
      title,
      body,
      data: {
        conversationId: input.conversationId,
        messageId: input.messageId,
      },
    });

    await emitNotificationSocket(p.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      createdAt: notification.createdAt,
    });

    await queue.enqueue(JOB_TYPES.PROCESS_NOTIFICATION, {
      notificationId: notification.id,
    });
  }

  if (input.conversationType === ConversationType.GROUP) {
    const names = extractMentionedNames(input.content);
    if (names.length === 0) {
      return;
    }
    for (const p of participants) {
      if (p.userId === input.senderId) {
        continue;
      }
      const uname = p.user.name.toLowerCase();
      const uemail = p.user.email.split('@')[0]?.toLowerCase() ?? '';
      if (!names.some((n) => n === uname || n === uemail)) {
        continue;
      }
      const n = await createNotification({
        userId: p.userId,
        type: NotificationType.MENTION,
        title: 'You were mentioned',
        body: `${input.senderName} mentioned you in a group`,
        data: { conversationId: input.conversationId, messageId: input.messageId },
      });
      await emitNotificationSocket(p.userId, {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        createdAt: n.createdAt,
      });
      await queue.enqueue(JOB_TYPES.PROCESS_NOTIFICATION, { notificationId: n.id });
    }
  }
}

export async function notifyAddedToGroup(input: {
  conversationId: string;
  conversationName: string;
  actorName: string;
  targetUserId: string;
}): Promise<void> {
  const notification = await createNotification({
    userId: input.targetUserId,
    type: NotificationType.ADDED_TO_GROUP,
    title: 'Added to group',
    body: `${input.actorName} added you to ${input.conversationName}`,
    data: { conversationId: input.conversationId },
  });
  await emitNotificationSocket(input.targetUserId, {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    createdAt: notification.createdAt,
  });
  await getQueueProvider().enqueue(JOB_TYPES.PROCESS_NOTIFICATION, {
    notificationId: notification.id,
  });
  logger.info(
    { targetUserId: input.targetUserId, conversationId: input.conversationId },
    'group add notification created',
  );
}
