import 'dotenv/config';
import { initSentry, Sentry } from './config/sentry';
initSentry('worker');

import { Worker } from 'bullmq';
import { prisma } from './config/database';
import { redisClient, connectRedis } from './config/redis';
import { logger } from './config/logger';
import { jobDuration } from './config/metrics';
import { ScraperRegistry } from './scrapers/registry';
import { JumiaScraper } from './scrapers/jumia';
import { JijiScraper } from './scrapers/jiji';
import { KongaScraper } from './scrapers/konga';
import { NormalizationService } from './api/v1/search/normalization';
import { ScraperService } from './services/ScraperService';
import { PriceCheckService } from './services/PriceCheckService';
import { RepositoryContainer } from './repositories/RepositoryContainer';
import { bullmqConnection, notificationQueue } from './queue';
import type { ScrapeQueueData, ScrapeJobData, PriceCheckJobData } from './queue/types';

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
  );

  const worker = new Worker<ScrapeQueueData>(
    'scrape',
    async (job) => {
      const jobLog = logger.child({ jobId: job.id, jobName: job.name });
      const endTimer = jobDuration.startTimer({ job_name: job.name });

      try {
        if (job.name === 'price-check') {
          const { trackedProductId } = job.data as PriceCheckJobData;
          jobLog.info({ trackedProductId }, 'Price-check started');
          const alertData = await priceCheckService.checkPrice(trackedProductId);
          if (alertData) await notificationQueue.add('price-alert', alertData);
          endTimer({ status: 'success' });
          jobLog.info({ trackedProductId }, 'Price-check complete');
          return;
        }

        const { jobDbId, query, queryType, filters } = job.data as ScrapeJobData;
        jobLog.info({ jobDbId, queryType, query }, 'Scrape job started');

        await prisma.scrapeJob.update({
          where: { id: jobDbId },
          data: { status: 'RUNNING', attempts: { increment: 1 } },
        });

        const results = queryType === 'keyword'
          ? await scraperService.searchByKeyword(query, filters)
          : [await scraperService.searchByUrl(query)];

        await prisma.scrapeJob.update({
          where: { id: jobDbId },
          data: { status: 'COMPLETED', results: results as never, completedAt: new Date() },
        });

        endTimer({ status: 'success' });
        jobLog.info({ jobDbId, resultCount: results.length }, 'Scrape job complete');
      } catch (err) {
        endTimer({ status: 'error' });
        throw err;
      }
    },
    {
      connection: { ...bullmqConnection, maxRetriesPerRequest: null as unknown as number },
      concurrency: 3,
    },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    Sentry.captureException(err, { tags: { jobName: job.name, jobId: job.id } });

    if (job.name === 'price-check') {
      const { trackedProductId } = job.data as PriceCheckJobData;
      logger.error({ trackedProductId, err: err.message }, 'Price-check job failed');
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      const { jobDbId } = job.data as ScrapeJobData;
      logger.error({ jobDbId, err: err.message }, 'Scrape job permanently failed');
      await prisma.scrapeJob
        .update({ where: { id: jobDbId }, data: { status: 'FAILED', error: err.message } })
        .catch(e => logger.error({ err: e }, 'Failed to mark job as failed'));
    }
  });

  worker.on('error', err => logger.error({ err }, 'Worker error'));
  logger.info('Worker started — waiting for scrape and price-check jobs');

  const shutdown = async () => {
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startWorker().catch(err => {
  logger.error({ err }, 'Fatal worker startup error');
  process.exit(1);
});
