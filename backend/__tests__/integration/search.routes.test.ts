import { describe, test, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { searchRouter, disconnectSearchService } from '../../src/api/v1/search/routes';
import { errorHandler } from '../../src/middleware/errorHandler';

// Mock rate limiters
vi.mock('../../src/middleware/rateLimiter', () => ({
  unauthenticatedLimiter: (_req: any, _res: any, next: any) => next(),
  authenticatedLimiter:   (_req: any, _res: any, next: any) => next(),
  enableRedisRateLimiting: vi.fn(),
  getRedisClient: vi.fn(() => null),
  redisClient: null,
}));

// Mock the SearchSubmitService used by the routes
vi.mock('../../src/services/SearchSubmitService', () => {
  class MockSearchSubmitService {
    async submitKeyword(keyword: string) {
      if (!keyword || keyword.trim().length < 2) {
        const { ValidationError } = require('../../src/shared/errors');
        throw new ValidationError('Search keyword must be at least 2 characters');
      }
      return {
        jobId: 'test-job-id',
        status: 'COMPLETED',
        results: [{ products: [{ platform: 'jumia', name: 'Test Product', price: 10000, currency: 'NGN', rating: 4.5, reviewCount: 100, url: 'https://www.jumia.com.ng/test', availability: true, imageUrl: null }], bestValueIndex: 0, searchQuery: keyword, timestamp: new Date() }],
        count: 1,
      };
    }
    async submitUrl(_url: string) {
      return {
        jobId: 'test-url-job-id',
        status: 'COMPLETED',
        results: [{ products: [{ platform: 'jumia', name: 'Test Product', price: 10000, currency: 'NGN', rating: 4.5, reviewCount: 100, url: 'https://www.jumia.com.ng/test', availability: true, imageUrl: null }], bestValueIndex: 0, searchQuery: _url, timestamp: new Date() }],
        count: 1,
      };
    }
    async getJobStatus(_id: string) { return { jobId: _id, status: 'COMPLETED', results: null, error: null, createdAt: new Date(), completedAt: new Date() }; }
  }
  return { SearchSubmitService: MockSearchSubmitService, buildFiltersKey: vi.fn(() => '{}') };
});

// Mock Prisma and BullMQ used at module level in routes
vi.mock('../../src/config/database', () => ({ prisma: {} }));
vi.mock('../../src/queue', () => ({ scrapeQueue: { add: vi.fn() }, bullmqConnection: {} }));
vi.mock('../../src/repositories/ScrapeJobRepository', () => ({ ScrapeJobRepository: vi.fn() }));

describe('Search Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/search', searchRouter);
    app.use(errorHandler);
  });

  describe('POST /search/keyword', () => {
    test('should return job response for valid keyword', async () => {
      const response = await request(app)
        .post('/search/keyword')
        .send({ keyword: 'laptop' });

      expect([200, 202]).toContain(response.status);
      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status');
    });

    test('should reject keyword with less than 2 characters', async () => {
      const response = await request(app)
        .post('/search/keyword')
        .send({ keyword: 'a' })
        .expect(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject missing keyword', async () => {
      const response = await request(app)
        .post('/search/keyword')
        .send({})
        .expect(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject empty keyword', async () => {
      const response = await request(app)
        .post('/search/keyword')
        .send({ keyword: '' })
        .expect(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /search/url', () => {
    test('should return job response for valid URL', async () => {
      const response = await request(app)
        .post('/search/url')
        .send({ url: 'https://www.jumia.com.ng/test-product.html' });

      expect([200, 202]).toContain(response.status);
      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status');
    });

    test('should reject invalid URL format', async () => {
      const response = await request(app)
        .post('/search/url')
        .send({ url: 'not-a-valid-url' })
        .expect(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject missing URL', async () => {
      const response = await request(app)
        .post('/search/url')
        .send({})
        .expect(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject empty URL', async () => {
      const response = await request(app)
        .post('/search/url')
        .send({ url: '' })
        .expect(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  test('disconnectSearchService is a no-op', async () => {
    await expect(disconnectSearchService()).resolves.toBeUndefined();
  });
});
