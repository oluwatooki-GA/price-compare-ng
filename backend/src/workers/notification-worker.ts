import 'dotenv/config';
import { initSentry, Sentry } from '../config/sentry';
initSentry('notification-worker');

import { Worker } from 'bullmq';
import { connectRedis } from '../config/redis';
import { logger } from '../config/logger';
import { bullmqConnection } from '../queue';
import { AlertEmailService } from '../services/AlertEmailService';
import type { AlertJobData } from '../queue/types';

async function startNotificationWorker(): Promise<void> {
  await connectRedis();

  const alertEmailService = new AlertEmailService();

  const worker = new Worker<AlertJobData>(
    'notification',
    async (job) => {
      logger.info({ jobId: job.id, trackedProductId: job.data.trackedProductId, userEmail: job.data.userEmail }, 'Sending price alert');
      await alertEmailService.sendPriceAlert(job.data);
      logger.info({ jobId: job.id }, 'Price alert sent');
    },
    {
      connection: { ...bullmqConnection, maxRetriesPerRequest: null as unknown as number },
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    Sentry.captureException(err, { tags: { jobId: job?.id } });
    logger.error({ jobId: job?.id, err: err.message }, 'Notification job failed');
  });

  worker.on('error', err => logger.error({ err }, 'Notification worker error'));
  logger.info('Notification worker started — waiting for alert jobs');

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startNotificationWorker().catch(err => {
  logger.error({ err }, 'Fatal notification-worker startup error');
  process.exit(1);
});
