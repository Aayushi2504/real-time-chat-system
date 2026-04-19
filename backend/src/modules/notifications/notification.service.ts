import { NotificationStatus, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';
import { publishFanout } from '../redis/chatEventBus';

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
}) {
  const n = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data === undefined ? undefined : input.data,
      status: NotificationStatus.PENDING,
    },
  });
  return n;
}

export async function listNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const n = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!n) {
    throw new NotFoundError('Notification not found');
  }
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function emitNotificationSocket(userId: string, payload: unknown) {
  await publishFanout({
    event: 'notification:new',
    room: `user:${userId}`,
    payload,
  });
}
