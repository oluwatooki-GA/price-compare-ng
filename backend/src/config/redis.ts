import { createClient } from 'redis';
import { config } from './env';

export const redisClient = createClient({ url: config.REDIS_URL });
redisClient.on('error', err => console.error('[Redis] error:', err));

export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('[Redis] connected');
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient.isOpen) {
    await redisClient.quit();
    console.log('[Redis] disconnected');
  }
}
