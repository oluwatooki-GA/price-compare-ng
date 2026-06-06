import { Queue } from 'bullmq';
import { bullmqConnection } from './index';
import type { AlertJobData } from './types';

export function createNotificationQueue(): Queue<AlertJobData> {
  return new Queue<AlertJobData>('notification', {
    connection: bullmqConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
  });
}
