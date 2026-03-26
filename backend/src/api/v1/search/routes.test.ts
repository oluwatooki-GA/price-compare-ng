import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { searchRouter, disconnectSearchService } from './routes';
import { errorHandler } from '../../../middleware/errorHandler';

// Mock the rate limiter to avoid Redis dependency in tests
vi.mock('../middleware/rateLimiter.js', () => ({
  unauthenticatedLimiter: (_req: any, _res: any, next: any) => next(),
  authenticatedLimiter: (_req: any, _res: any, next: any) => next(),
}));

// Mock the search service
vi.mock('./service.js', () => {
  class MockSearchService {
    async connect() {}
    async disconnect() {}
    async searchByKeyword(_keyword: string) {
      return [
        {
          products: [
            {
              platform: 'jumia',
              name: 'Test Product',
              price: 10000,
              currency: 'NGN',
              rating: 4.5,
              reviewCount: 100,
              url: 'https://www.jumia.com.ng/test',
              availability: true,
              imageUrl: 'https://example.com/image.jpg'
            }
          ],
          bestValueIndex: 0,
          searchQuery: 'test',
          timestamp: new Date()
        }
      ];
    }
    async searchByUrl(_url: string) {
      return {
        products: [
          {
            platform: 'jumia',
            name: 'Test Product',
            price: 10000,
            currency: 'NGN',
            rating: 4.5,
            reviewCount: 100,
            url: 'https://www.jumia.com.ng/test',
            availability: true,
            imageUrl: 'https://example.com/image.jpg'
          }
        ],
        bestValueIndex: 0,
        searchQuery: 'https://www.jumia.com.ng/test',
        timestamp: new Date()
      };
    }
    validateUrl(_url: string) {
      return { isValid: true, platform: 'jumia' };
    }
  }
  
  return {
    SearchService: MockSearchService
  };
});

describe('Search Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/search', searchRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await disconnectSearchService();
  });

  describe('POST /search/keyword', () => {
    test('should return search results for valid keyword', async () => {
      const response = await request(app)
        .post('/search/keyword')
        .send({ keyword: 'laptop' })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.results)).toBe(true);
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
    test('should return search results for valid URL', async () => {
      const response = await request(app)
        .post('/search/url')
        .send({ url: 'https://www.jumia.com.ng/test-product.html' })
        .expect(200);

      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('products');
      expect(response.body.result).toHaveProperty('bestValueIndex');
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
});
