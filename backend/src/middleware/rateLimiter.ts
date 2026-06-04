import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';

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

export function enableRedisRateLimiting(): void {
  if (!redisClient) return;
  const store = new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  });
  (unauthenticatedLimiter as unknown as { store: unknown }).store = store;
  (authenticatedLimiter  as unknown as { store: unknown }).store = store;
  console.log('Redis rate limiting enabled');
}

export function getRedisClient() {
  return redisClient;
}

// Keep for backward compatibility with existing tests
export { redisClient };
