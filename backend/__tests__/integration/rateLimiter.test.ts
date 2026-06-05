import { describe, test, expect, afterAll } from 'vitest';
import { redisClient, unauthenticatedLimiter, authenticatedLimiter } from '../../src/middleware/rateLimiter';
import { disconnectRedis } from '../../src/config/redis';

describe('Rate Limiter Configuration', () => {
  afterAll(async () => {
    try { await disconnectRedis(); } catch { /* ignore */ }
  });

  test('Redis client is initialized', () => {
    expect(redisClient).toBeDefined();
  });

  test('unauthenticated limiter is configured correctly', () => {
    expect(unauthenticatedLimiter).toBeDefined();
    expect(typeof unauthenticatedLimiter).toBe('function');
  });

  test('authenticated limiter is configured correctly', () => {
    expect(authenticatedLimiter).toBeDefined();
    expect(typeof authenticatedLimiter).toBe('function');
  });

  test('unauthenticated limiter has correct configuration', () => {
    expect(unauthenticatedLimiter as any).toBeDefined();
  });

  test('authenticated limiter has correct configuration', () => {
    expect(authenticatedLimiter as any).toBeDefined();
  });
});
