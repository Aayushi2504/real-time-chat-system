import { getRedis } from './redisClient';

const TTL_SEC = 120;
const roomKey = (conversationId: string) => `chat:conv:${conversationId}:members`;
const sessionsKey = (userId: string) => `chat:user:${userId}:sessions`;

export async function addUserSession(userId: string): Promise<number> {
  const r = getRedis();
  const n = await r.incr(sessionsKey(userId));
  await r.expire(sessionsKey(userId), TTL_SEC);
  return n;
}

export async function removeUserSession(userId: string): Promise<number> {
  const r = getRedis();
  const n = await r.decr(sessionsKey(userId));
  if (n <= 0) {
    await r.del(sessionsKey(userId));
    return 0;
  }
  await r.expire(sessionsKey(userId), TTL_SEC);
  return n;
}

export async function refreshUserSession(userId: string): Promise<void> {
  const r = getRedis();
  const exists = await r.exists(sessionsKey(userId));
  if (exists) {
    await r.expire(sessionsKey(userId), TTL_SEC);
  }
}

export async function isUserOnline(userId: string): Promise<boolean> {
  const v = await getRedis().get(sessionsKey(userId));
  return v !== null && parseInt(v, 10) > 0;
}

export async function joinConversationRoom(userId: string, conversationId: string): Promise<void> {
  await getRedis().sadd(roomKey(conversationId), userId);
  await getRedis().expire(roomKey(conversationId), 86400);
}

export async function leaveConversationRoom(userId: string, conversationId: string): Promise<void> {
  await getRedis().srem(roomKey(conversationId), userId);
}

export async function isUserInConversationRoom(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const v = await getRedis().sismember(roomKey(conversationId), userId);
  return v === 1;
}
