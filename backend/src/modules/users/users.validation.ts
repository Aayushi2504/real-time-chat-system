import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().optional().default(''),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});
