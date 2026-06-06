import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import { prisma } from '../config/database';
import { connectRedis } from '../config/redis';
import { bullmqConnection, scrapeQueue } from '../queue';
import { TrackedProductRepository } from '../repositories/TrackedProductRepository';
import type { PriceCheckJobData } from '../queue/types';

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 5000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startScheduler(): Promise<void> {
  await connectRedis();

  const trackedProductRepository = new TrackedProductRepository(prisma);

  const schedulerQueue = new Queue('scheduler', {
    connection: bullmqConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 1 },
      removeOnFail: { age: 86400 },
    },
  });

  await schedulerQueue.add(
    'tick',
    {},
    {
      repeat: { every: THREE_DAYS_MS },
      jobId: 'price-check-scheduler-tick',
    },
  );

  const worker = new Worker(
    'scheduler',
    async () => {
      console.log('[scheduler] Tick — queuing price-check jobs for all active tracked products');

      const total = await trackedProductRepository.countActive();
      let offset = 0;
      let queued = 0;

      while (offset < total) {
        const batch = await trackedProductRepository.findAllActive(BATCH_SIZE, offset);
        if (batch.length === 0) break;

        const jobs = batch.map(tp => ({
          name: 'price-check' as const,
          data: {
            trackedProductId: tp.id,
            productUrl: tp.productUrl,
            platform: tp.platform,
            userId: tp.userId,
          } satisfies PriceCheckJobData,
          opts: { attempts: 2, backoff: { type: 'exponential' as const, delay: 5000 } },
        }));

        await scrapeQueue.addBulk(jobs);
        queued += jobs.length;
        offset += BATCH_SIZE;

        if (offset < total) await sleep(BATCH_DELAY_MS);
      }

      console.log(`[scheduler] Queued ${queued} price-check job(s)`);
    },
    {
      connection: { ...bullmqConnection, maxRetriesPerRequest: null as unknown as number },
    },
  );

  worker.on('error', err => console.error('[scheduler] Worker error:', err));
  console.log('[scheduler] Started — will queue price checks every 3 days');

  const shutdown = async () => {
    await worker.close();
    await schedulerQueue.close();
    await scrapeQueue.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startScheduler().catch(err => {
  console.error('[scheduler] Fatal startup error:', err);
  process.exit(1);
});
