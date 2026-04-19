import { z } from 'zod';
import { MessageType } from '@prisma/client';

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(20000),
  type: z.nativeEnum(MessageType).optional(),
});

export const messagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});
