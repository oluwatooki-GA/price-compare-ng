import 'dotenv/config';
import { Worker } from 'bullmq';
import { connectRedis } from '../config/redis';
import { bullmqConnection } from '../queue';
import { AlertEmailService } from '../services/AlertEmailService';
import type { AlertJobData } from '../queue/types';

async function startNotificationWorker(): Promise<void> {
  await connectRedis();

  const alertEmailService = new AlertEmailService();

  const worker = new Worker<AlertJobData>(
    'notification',
    async (job) => {
      console.log(`[notification-worker] Sending price alert to ${job.data.userEmail} for product ${job.data.trackedProductId}`);
      await alertEmailService.sendPriceAlert(job.data);
    },
    {
      connection: { ...bullmqConnection, maxRetriesPerRequest: null as unknown as number },
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[notification-worker] Failed job ${job?.id}:`, err.message);
  });

  worker.on('error', err => console.error('[notification-worker] Worker error:', err));
  console.log('[notification-worker] Started — waiting for alert jobs...');

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startNotificationWorker().catch(err => {
  console.error('[notification-worker] Fatal startup error:', err);
  process.exit(1);
});
