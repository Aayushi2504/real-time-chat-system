import type { QueueProvider, EnqueueOptions } from './QueueProvider';
import type { JobType } from './queue.types';
import { logger } from '../../utils/logger';

/**
 * AWS SQS-ready provider scaffold.
 * Wire @aws-sdk/client-sqs and map SendMessageCommand + message attributes for visibility timeout / DLQ (configured on the queue in AWS).
 * For local development use LocalQueueProvider (database-backed) instead.
 */
export class SQSQueueProvider implements QueueProvider {
  readonly name = 'sqs';

  async enqueue(_type: JobType, _payload: unknown, _options?: EnqueueOptions): Promise<string> {
    logger.warn('SQSQueueProvider.enqueue called but AWS SDK is not wired in this repo scaffold');
    throw new Error(
      'SQSQueueProvider is a scaffold: install @aws-sdk/client-sqs, set SQS_QUEUE_URL, and implement SendMessage.',
    );
  }
}
