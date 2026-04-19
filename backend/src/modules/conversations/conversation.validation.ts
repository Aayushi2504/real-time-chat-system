import { z } from 'zod';

export const createConversationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('DIRECT'),
    participantId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('GROUP'),
    name: z.string().min(1).max(120),
    participantIds: z.array(z.string().uuid()).min(1),
  }),
]);

export const addParticipantSchema = z.object({
  userId: z.string().uuid(),
});
