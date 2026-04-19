import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  QUEUE_PROVIDER: z.enum(['local', 'sqs']).default('local'),
  AWS_REGION: z.string().optional(),
  SQS_QUEUE_URL: z.string().optional(),
  SQS_DLQ_URL: z.string().optional(),
  VISIBILITY_TIMEOUT_MS: z.coerce.number().default(30_000),
  MAX_QUEUE_RETRIES: z.coerce.number().default(5),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  WORKER_ID: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}

export const env = loadEnv();
