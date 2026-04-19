import type { JobType } from './queue.types';

export type EnqueueOptions = {
  maxRetries?: number;
  delayMs?: number;
};

export interface QueueProvider {
  readonly name: string;
  enqueue<T extends JobType>(
    type: T,
    payload: unknown,
    options?: EnqueueOptions,
  ): Promise<string>;
}
