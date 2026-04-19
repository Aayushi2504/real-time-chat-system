import { z } from 'zod';

export const testFailureBodySchema = z.object({
  forceFail: z.boolean().optional().default(true),
});
