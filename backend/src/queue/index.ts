import { Queue } from 'bullmq';
import { config } from '../config/env';
import type { ScrapeQueueData } from './types';

const redisUrl = new URL(config.REDIS_URL);

export const bullmqConnection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port, 10) || 6379,
  ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
  // Required: prevents ioredis from timing out pending commands during reconnect
  maxRetriesPerRequest: null as unknown as number,
};

export const scrapeQueue = new Queue<ScrapeQueueData>('scrape', {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600 },  // keep completed jobs 1 hour
    removeOnFail:    { age: 86400 },  // keep failed jobs 24 hours
  },
});
