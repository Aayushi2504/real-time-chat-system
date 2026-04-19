import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { ConflictError, UnauthorizedError } from '../../utils/errors';

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('Email already registered');
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
    },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  const token = signToken(user.id, user.email);
  return { user, token };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new UnauthorizedError('Invalid credentials');
  }
  const token = signToken(user.id, user.email);
  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  };
}

export function signToken(userId: string, email: string) {
  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      isOnline: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });
  return user;
}
