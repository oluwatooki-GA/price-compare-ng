import 'dotenv/config';
import { Worker } from 'bullmq';
import { createClient } from 'redis';
import { prisma } from './config/database';
import { config } from './config/env';
import { ScraperRegistry } from './scrapers/registry';
import { JumiaScraper } from './scrapers/jumia';
import { JijiScraper } from './scrapers/jiji';
import { KongaScraper } from './scrapers/konga';
import { NormalizationService } from './api/v1/search/normalization';
import { SearchService } from './api/v1/search/service';
import { bullmqConnection } from './queue';
import type { ScrapeJobData } from './queue/types';

async function startWorker(): Promise<void> {
  // Redis client for SearchService result caching
  const redisCache = createClient({ url: config.REDIS_URL });
  redisCache.on('error', err => console.error('[worker] Redis error:', err));
  await redisCache.connect();

  // Mirror the scraper setup in search/routes.ts
  const scraperRegistry = new ScraperRegistry();
  scraperRegistry.registerScraper(new JumiaScraper());
  scraperRegistry.registerScraper(new JijiScraper());
  scraperRegistry.registerScraper(new KongaScraper());

  const searchService = new SearchService(
    scraperRegistry,
    new NormalizationService(),
    redisCache,
  );

  const worker = new Worker<ScrapeJobData>(
    'scrape',
    async (job) => {
      const { jobDbId, query, queryType, filters } = job.data;

      await prisma.scrapeJob.update({
        where: { id: jobDbId },
        data: { status: 'RUNNING', attempts: { increment: 1 } },
      });

      let results;
      if (queryType === 'keyword') {
        results = await searchService.searchByKeyword(query, filters);
      } else {
        results = [await searchService.searchByUrl(query)];
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

  // Only mark FAILED in DB once all BullMQ retry attempts are exhausted
  worker.on('failed', async (job, err) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      console.error(`[worker] Job ${job.data.jobDbId} permanently failed:`, err.message);
      await prisma.scrapeJob
        .update({
          where: { id: job.data.jobDbId },
          data: { status: 'FAILED', error: err.message },
        })
        .catch(console.error);
    }
  });

  worker.on('error', err => console.error('[worker] Worker error:', err));

  console.log('[worker] Started — waiting for scrape jobs...');

  const shutdown = async () => {
    console.log('[worker] Shutting down...');
    await worker.close();
    await redisCache.quit().catch(() => {});
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
