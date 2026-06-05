import 'dotenv/config';
import { Worker } from 'bullmq';
import { prisma } from './config/database';
import { redisClient, connectRedis } from './config/redis';
import { ScraperRegistry } from './scrapers/registry';
import { JumiaScraper } from './scrapers/jumia';
import { JijiScraper } from './scrapers/jiji';
import { KongaScraper } from './scrapers/konga';
import { NormalizationService } from './api/v1/search/normalization';
import { ScraperService } from './services/ScraperService';
import { PriceCheckService } from './services/PriceCheckService';
import { RepositoryContainer } from './repositories/RepositoryContainer';
import { bullmqConnection } from './queue';
import { notificationQueue } from './queue/notificationQueue';
import type { ScrapeQueueData } from './queue/types';

async function startWorker(): Promise<void> {
  await connectRedis();

  const scraperRegistry = new ScraperRegistry();
  scraperRegistry.registerScraper(new JumiaScraper());
  scraperRegistry.registerScraper(new JijiScraper());
  scraperRegistry.registerScraper(new KongaScraper());

  const scraperService = new ScraperService(
    scraperRegistry,
    new NormalizationService(),
    redisClient,
  );

  const repositoryContainer = RepositoryContainer.getInstance(prisma);
  const priceCheckService = new PriceCheckService(
    scraperRegistry,
    repositoryContainer.getTrackedProductRepository(),
    repositoryContainer.getTrackedPriceHistoryRepository(),
    repositoryContainer.getUserRepository(),
    notificationQueue,
  );

  const worker = new Worker<ScrapeQueueData>(
    'scrape',
    async (job) => {
      if (job.data.jobType === 'price-check') {
        const { trackedProductId } = job.data;
        console.log(`[worker] Price-check job for trackedProduct ${trackedProductId}`);
        await priceCheckService.checkPrice(trackedProductId);
        console.log(`[worker] Price-check complete for trackedProduct ${trackedProductId}`);
        return;
      }

      // Regular scrape job
      const { jobDbId, query, queryType, filters } = job.data;

      await prisma.scrapeJob.update({
        where: { id: jobDbId },
        data: { status: 'RUNNING', attempts: { increment: 1 } },
      });

      let results;
      if (queryType === 'keyword') {
        results = await scraperService.searchByKeyword(query, filters);
      } else {
        results = [await scraperService.searchByUrl(query)];
      }

      await prisma.scrapeJob.update({
        where: { id: jobDbId },
        data: {
          status: 'COMPLETED',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          results: results as any,
          completedAt: new Date(),
        },
      });

      console.log(`[worker] Job ${jobDbId} completed — ${results.length} result(s)`);
    },
    {
      connection: { ...bullmqConnection, maxRetriesPerRequest: null as unknown as number },
      concurrency: 3,
    },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    if (job.data.jobType === 'price-check') {
      console.error(`[worker] Price-check job for trackedProduct ${job.data.trackedProductId} failed:`, err.message);
      return;
    }
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      const scrapeJob = job.data as { jobDbId: string };
      console.error(`[worker] Job ${scrapeJob.jobDbId} permanently failed:`, err.message);
      await prisma.scrapeJob
        .update({ where: { id: scrapeJob.jobDbId }, data: { status: 'FAILED', error: err.message } })
        .catch(console.error);
    }
  });

  worker.on('error', err => console.error('[worker] Worker error:', err));
  console.log('[worker] Started — waiting for scrape and price-check jobs...');

  const shutdown = async () => {
    await worker.close();
    await notificationQueue.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startWorker().catch(err => {
  console.error('[worker] Fatal startup error:', err);
  process.exit(1);
});
