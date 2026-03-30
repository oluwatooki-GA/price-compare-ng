import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config/env';

// Redis client for rate limiting
let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Initialize Redis client for rate limiting
 */
export async function initRedisClient(): Promise<void> {
  if (!config.REDIS_URL) {
    console.log('Redis URL not configured, using in-memory rate limiting');
    return;
  }

  try {
    redisClient = createClient({ url: config.REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    await redisClient.connect();
    console.log('Redis rate limiter connected');
  } catch (error) {
    console.warn('Failed to connect Redis for rate limiting, using in-memory:', error);
    redisClient = null;
  }
}

/**
 * Create Redis store or undefined (falls back to memory)
 */
function createRedisStore() {
  if (!redisClient) return undefined;

  return new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
  });
}

/**
 * Rate limiter for unauthenticated requests
 */
export const unauthenticatedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests from this IP, please try again later.',
    });
  },
});

/**
 * Rate limiter for authenticated requests
 */
export const authenticatedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => {
    // @ts-expect-error - user is added by auth middleware
    return req.user?.id?.toString() || req.ip || 'unknown';
  },
  message: 'Too many requests, please try again later.',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    // @ts-expect-error - user is added by auth middleware
    const identifier = req.user?.id || req.ip;
    console.warn(`Rate limit exceeded for user/IP: ${identifier}`);
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests, please try again later.',
    });
  },
});

/**
 * Update rate limiters to use Redis (call after Redis is connected)
 */
export function enableRedisRateLimiting(): void {
  const store = createRedisStore();
  if (store) {
    (unauthenticatedLimiter as any).store = store;
    (authenticatedLimiter as any).store = store;
    console.log('Redis rate limiting enabled');
  }
}

/**
 * Gracefully disconnect Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
}

// Export for compatibility with tests
export { redisClient };
