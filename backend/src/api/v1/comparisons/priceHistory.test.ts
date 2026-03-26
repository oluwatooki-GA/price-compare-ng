/**
 * Unit tests for PriceHistoryService
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PriceHistoryService } from './priceHistory';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrismaClient = {
  priceHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
} as unknown as PrismaClient;

describe('PriceHistoryService', () => {
  let priceHistoryService: PriceHistoryService;

  beforeEach(() => {
    priceHistoryService = new PriceHistoryService(mockPrismaClient);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('recordPrice', () => {
    test('should store price snapshot with all required fields', async () => {
      const productUrl = 'https://jumia.com/laptop-hp';
      const platform = 'jumia';
      const price = 500000;
      const currency = 'NGN';

      (mockPrismaClient.priceHistory.create as any).mockResolvedValue({
        id: 1,
        productUrl,
        platform,
        price,
        currency,
        recordedAt: new Date(),
      });

      await priceHistoryService.recordPrice(productUrl, platform, price, currency);

      expect(mockPrismaClient.priceHistory.create).toHaveBeenCalledWith({
        data: {
          productUrl,
          platform,
          price,
          currency,
          recordedAt: expect.any(Date),
        },
      });
    });

    test('should use default currency NGN when not specified', async () => {
      const productUrl = 'https://konga.com/phone';
      const platform = 'konga';
      const price = 150000;

      (mockPrismaClient.priceHistory.create as any).mockResolvedValue({
        id: 2,
        productUrl,
        platform,
        price,
        currency: 'NGN',
        recordedAt: new Date(),
      });

      await priceHistoryService.recordPrice(productUrl, platform, price);

      expect(mockPrismaClient.priceHistory.create).toHaveBeenCalledWith({
        data: {
          productUrl,
          platform,
          price,
          currency: 'NGN',
          recordedAt: expect.any(Date),
        },
      });
    });

    test('should record current timestamp', async () => {
      const beforeCall = new Date();
      
      (mockPrismaClient.priceHistory.create as any).mockResolvedValue({
        id: 3,
        productUrl: 'https://jumia.com/test',
        platform: 'jumia',
        price: 100,
        currency: 'NGN',
        recordedAt: new Date(),
      });

      await priceHistoryService.recordPrice('https://jumia.com/test', 'jumia', 100);

      const afterCall = new Date();
      const callArgs = (mockPrismaClient.priceHistory.create as any).mock.calls[0][0];
      const recordedAt = callArgs.data.recordedAt;

      expect(recordedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(recordedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    test('should handle database errors', async () => {
      (mockPrismaClient.priceHistory.create as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        priceHistoryService.recordPrice('https://jumia.com/test', 'jumia', 100)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('getPriceHistory', () => {
    test('should retrieve price history for specific product and platform', async () => {
      const productUrl = 'https://jumia.com/laptop-hp';
      const platform = 'jumia';
      const mockRecords = [
        {
          id: 1,
          productUrl,
          platform,
          price: 500000,
          currency: 'NGN',
          recordedAt: new Date('2024-01-01'),
        },
        {
          id: 2,
          productUrl,
          platform,
          price: 480000,
          currency: 'NGN',
          recordedAt: new Date('2024-01-15'),
        },
      ];

      (mockPrismaClient.priceHistory.findMany as any).mockResolvedValue(mockRecords);

      const result = await priceHistoryService.getPriceHistory(productUrl, platform, 30);

      expect(result).toEqual(mockRecords);
      expect(mockPrismaClient.priceHistory.findMany).toHaveBeenCalledWith({
        where: {
          productUrl,
          platform,
          recordedAt: {
            gte: expect.any(Date),
          },
        },
        orderBy: {
          recordedAt: 'asc',
        },
      });
    });

    test('should use default 30 days when days parameter not specified', async () => {
      const productUrl = 'https://konga.com/phone';
      const platform = 'konga';

      (mockPrismaClient.priceHistory.findMany as any).mockResolvedValue([]);

      await priceHistoryService.getPriceHistory(productUrl, platform);

      const callArgs = (mockPrismaClient.priceHistory.findMany as any).mock.calls[0][0];
      const cutoffDate = callArgs.where.recordedAt.gte;
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - 30);

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);
    });

    test('should calculate correct cutoff date for specified days', async () => {
      const productUrl = 'https://jumia.com/test';
      const platform = 'jumia';
      const days = 7;

      (mockPrismaClient.priceHistory.findMany as any).mockResolvedValue([]);

      await priceHistoryService.getPriceHistory(productUrl, platform, days);

      const callArgs = (mockPrismaClient.priceHistory.findMany as any).mock.calls[0][0];
      const cutoffDate = callArgs.where.recordedAt.gte;
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - days);

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);
    });

    test('should return empty array when no history exists', async () => {
      (mockPrismaClient.priceHistory.findMany as any).mockResolvedValue([]);

      const result = await priceHistoryService.getPriceHistory(
        'https://jumia.com/nonexistent',
        'jumia',
        30
      );

      expect(result).toEqual([]);
    });

    test('should order results by recordedAt ascending', async () => {
      const mockRecords = [
        {
          id: 1,
          productUrl: 'https://jumia.com/test',
          platform: 'jumia',
          price: 100,
          currency: 'NGN',
          recordedAt: new Date('2024-01-01'),
        },
        {
          id: 2,
          productUrl: 'https://jumia.com/test',
          platform: 'jumia',
          price: 90,
          currency: 'NGN',
          recordedAt: new Date('2024-01-15'),
        },
      ];

      (mockPrismaClient.priceHistory.findMany as any).mockResolvedValue(mockRecords);

      await priceHistoryService.getPriceHistory('https://jumia.com/test', 'jumia', 30);

      expect(mockPrismaClient.priceHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            recordedAt: 'asc',
          },
        })
      );
    });

    test('should only return records for specified product URL', async () => {
      const targetUrl = 'https://jumia.com/laptop-hp';
      const platform = 'jumia';

      (mockPrismaClient.priceHistory.findMany as any).mockResolvedValue([]);

      await priceHistoryService.getPriceHistory(targetUrl, platform, 30);

      expect(mockPrismaClient.priceHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productUrl: targetUrl,
          }),
        })
      );
    });

    test('should only return records for specified platform', async () => {
      const productUrl = 'https://jumia.com/laptop-hp';
      const platform = 'jumia';

      (mockPrismaClient.priceHistory.findMany as any).mockResolvedValue([]);

      await priceHistoryService.getPriceHistory(productUrl, platform, 30);

      expect(mockPrismaClient.priceHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            platform,
          }),
        })
      );
    });
  });

  describe('cleanupOldData', () => {
    test('should delete records older than 90 days', async () => {
      (mockPrismaClient.priceHistory.deleteMany as any).mockResolvedValue({ count: 42 });

      const deletedCount = await priceHistoryService.cleanupOldData();

      expect(deletedCount).toBe(42);
      expect(mockPrismaClient.priceHistory.deleteMany).toHaveBeenCalledWith({
        where: {
          recordedAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    test('should calculate correct 90-day cutoff date', async () => {
      (mockPrismaClient.priceHistory.deleteMany as any).mockResolvedValue({ count: 0 });

      await priceHistoryService.cleanupOldData();

      const callArgs = (mockPrismaClient.priceHistory.deleteMany as any).mock.calls[0][0];
      const cutoffDate = callArgs.where.recordedAt.lt;
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - 90);

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);
    });

    test('should return 0 when no old records exist', async () => {
      (mockPrismaClient.priceHistory.deleteMany as any).mockResolvedValue({ count: 0 });

      const deletedCount = await priceHistoryService.cleanupOldData();

      expect(deletedCount).toBe(0);
    });

    test('should handle database errors during cleanup', async () => {
      (mockPrismaClient.priceHistory.deleteMany as any).mockRejectedValue(
        new Error('Database error during cleanup')
      );

      await expect(priceHistoryService.cleanupOldData()).rejects.toThrow(
        'Database error during cleanup'
      );
    });

    test('should return count of deleted records', async () => {
      const expectedCount = 150;
      (mockPrismaClient.priceHistory.deleteMany as any).mockResolvedValue({ count: expectedCount });

      const deletedCount = await priceHistoryService.cleanupOldData();

      expect(deletedCount).toBe(expectedCount);
    });
  });

  describe('edge cases', () => {
    test('should handle very large price values', async () => {
      const largePrice = 999999999.99;

      (mockPrismaClient.priceHistory.create as any).mockResolvedValue({
        id: 1,
        productUrl: 'https://jumia.com/expensive',
        platform: 'jumia',
        price: largePrice,
        currency: 'NGN',
        recordedAt: new Date(),
      });

      await priceHistoryService.recordPrice('https://jumia.com/expensive', 'jumia', largePrice);

      expect(mockPrismaClient.priceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            price: largePrice,
          }),
        })
      );
    });

    test('should handle zero price values', async () => {
      (mockPrismaClient.priceHistory.create as any).mockResolvedValue({
        id: 1,
        productUrl: 'https://jumia.com/free',
        platform: 'jumia',
        price: 0,
        currency: 'NGN',
        recordedAt: new Date(),
      });

      await priceHistoryService.recordPrice('https://jumia.com/free', 'jumia', 0);

      expect(mockPrismaClient.priceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            price: 0,
          }),
        })
      );
    });

    test('should handle very long product URLs', async () => {
      const longUrl = 'https://jumia.com/' + 'a'.repeat(500);

      (mockPrismaClient.priceHistory.create as any).mockResolvedValue({
        id: 1,
        productUrl: longUrl,
        platform: 'jumia',
        price: 100,
        currency: 'NGN',
        recordedAt: new Date(),
      });

      await priceHistoryService.recordPrice(longUrl, 'jumia', 100);

      expect(mockPrismaClient.priceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productUrl: longUrl,
          }),
        })
      );
    });

    test('should handle different currency codes', async () => {
      const currencies = ['NGN', 'USD', 'EUR', 'GBP'];

      for (const currency of currencies) {
        (mockPrismaClient.priceHistory.create as any).mockResolvedValue({
          id: 1,
          productUrl: 'https://jumia.com/test',
          platform: 'jumia',
          price: 100,
          currency,
          recordedAt: new Date(),
        });

        await priceHistoryService.recordPrice('https://jumia.com/test', 'jumia', 100, currency);

        expect(mockPrismaClient.priceHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              currency,
            }),
          })
        );
      }
    });
  });
});
