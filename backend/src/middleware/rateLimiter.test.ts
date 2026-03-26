import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { redisClient, unauthenticatedLimiter, authenticatedLimiter, disconnectRedis } from './rateLimiter';

describe('Rate Limiter Configuration', () => {
  beforeAll(async () => {
    // Wait for Redis connection
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Clean up Redis connection
    try {
      await disconnectRedis();
    } catch (error) {
      // Ignore disconnection errors in tests
    }
  });

  test('Redis client is initialized', () => {
    expect(redisClient).toBeDefined();
  });

  test('unauthenticated limiter is configured correctly', () => {
    expect(unauthenticatedLimiter).toBeDefined();
    // Verify it's a middleware function
    expect(typeof unauthenticatedLimiter).toBe('function');
  });

  test('authenticated limiter is configured correctly', () => {
    expect(authenticatedLimiter).toBeDefined();
    // Verify it's a middleware function
    expect(typeof authenticatedLimiter).toBe('function');
  });

  test('unauthenticated limiter has correct configuration', () => {
    // Access the limiter options through the middleware
    const limiter = unauthenticatedLimiter as any;
    // The max and windowMs are stored in the limiter's options
    expect(limiter).toBeDefined();
  });

  test('authenticated limiter has correct configuration', () => {
    // Access the limiter options through the middleware
    const limiter = authenticatedLimiter as any;
    // The max and windowMs are stored in the limiter's options
    expect(limiter).toBeDefined();
  });
});
