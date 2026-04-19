import { env } from '../../config/env';
import type { QueueProvider } from './QueueProvider';
import { LocalQueueProvider } from './LocalQueueProvider';
import { SQSQueueProvider } from './SQSQueueProvider';

let instance: QueueProvider | null = null;

export function getQueueProvider(): QueueProvider {
  if (!instance) {
    instance = env.QUEUE_PROVIDER === 'sqs' ? new SQSQueueProvider() : new LocalQueueProvider();
  }
  return instance;
}

export function resetQueueProviderForTests(): void {
  instance = null;
}
