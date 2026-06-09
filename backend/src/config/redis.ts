import { createClient } from 'redis';
import { config } from './env';
import { logger } from './logger';

export const redisClient = createClient({ url: config.REDIS_URL });
redisClient.on('error', err => logger.error({ err }, 'Redis error'));

export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    logger.info('Redis connected');
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
}
