import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { RequestHandler } from 'express';
import { redisClient } from '../config/redis';
import { logger } from '../config/logger';

// When DISABLE_RATE_LIMIT=true, limiters become pass-throughs. Intended ONLY
// for load testing from a single IP — never enable this in production.
const RATE_LIMIT_DISABLED = process.env.DISABLE_RATE_LIMIT === 'true';

const passThrough: RequestHandler = (_req, _res, next) => next();

const realUnauthenticatedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, 'Rate limit exceeded');
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests from this IP, please try again later.',
    });
  },
});

const realAuthenticatedLimiter = rateLimit({
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
    logger.warn({ identifier }, 'Rate limit exceeded');
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests, please try again later.',
    });
  },
});

export const unauthenticatedLimiter: RequestHandler = RATE_LIMIT_DISABLED
  ? passThrough
  : realUnauthenticatedLimiter;

export const authenticatedLimiter: RequestHandler = RATE_LIMIT_DISABLED
  ? passThrough
  : realAuthenticatedLimiter;

export function enableRedisRateLimiting(): void {
  if (RATE_LIMIT_DISABLED) {
    logger.warn('Rate limiting DISABLED via DISABLE_RATE_LIMIT — do not use in production');
    return;
  }
  if (!redisClient) return;
  const store = new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  });
  (realUnauthenticatedLimiter as unknown as { store: unknown }).store = store;
  (realAuthenticatedLimiter  as unknown as { store: unknown }).store = store;
  logger.info('Redis rate limiting enabled');
}

export function getRedisClient() {
  return redisClient;
}

// Keep for backward compatibility with existing tests
export { redisClient };
