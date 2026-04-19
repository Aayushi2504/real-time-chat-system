import { prisma } from '../../lib/prisma';

export async function searchUsers(userId: string, q: string, limit = 20) {
  const take = Math.min(limit, 50);
  if (!q.trim()) {
    return prisma.user.findMany({
      where: { id: { not: userId } },
      take,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isOnline: true,
        lastSeenAt: true,
      },
    });
  }
  return prisma.user.findMany({
    where: {
      id: { not: userId },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    take,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      isOnline: true,
      lastSeenAt: true,
    },
  });
}

export async function listUsers(userId: string, limit = 50) {
  return prisma.user.findMany({
    where: { id: { not: userId } },
    take: Math.min(limit, 100),
    orderBy: { name: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      isOnline: true,
      lastSeenAt: true,
    },
  });
}
