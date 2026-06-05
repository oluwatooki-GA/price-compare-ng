import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PriceHistoryService } from '../../../src/services/PriceHistoryService';
import type { PriceHistoryRepository } from '../../../src/repositories/PriceHistoryRepository';

// Mock PriceHistoryRepository (the actual dependency)
const mockRepository = {
  create:           vi.fn(),
  findRecent:       vi.fn(),
  findHistory:      vi.fn(),
  deleteOlderThan:  vi.fn(),
} as unknown as PriceHistoryRepository;

describe('PriceHistoryService', () => {
  let priceHistoryService: PriceHistoryService;

  beforeEach(() => {
    priceHistoryService = new PriceHistoryService(mockRepository);
    vi.clearAllMocks();
  });

  afterEach(() => { vi.clearAllMocks(); });

  describe('recordPrice', () => {
    test('should store price snapshot with all required fields', async () => {
      const productUrl = 'https://jumia.com/laptop-hp';
      const platform = 'jumia';
      const price = 500000;
      const currency = 'NGN';

      (mockRepository.findRecent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, productUrl, platform, price, currency, recordedAt: new Date() });

      await priceHistoryService.recordPrice(productUrl, platform, price, currency);

      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({ productUrl, platform, price, currency, recordedAt: expect.any(Date) }));
    });

    test('should use default currency NGN when not specified', async () => {
      (mockRepository.findRecent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await priceHistoryService.recordPrice('https://konga.com/phone', 'konga', 150000);

      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({ currency: 'NGN' }));
    });

    test('should record current timestamp', async () => {
      const before = new Date();
      (mockRepository.findRecent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await priceHistoryService.recordPrice('https://jumia.com/test', 'jumia', 100);

      const after = new Date();
      const callArgs = (mockRepository.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.recordedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(callArgs.recordedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should handle database errors', async () => {
      (mockRepository.findRecent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockRepository.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Database connection failed'));

      await expect(priceHistoryService.recordPrice('https://jumia.com/test', 'jumia', 100)).rejects.toThrow('Database connection failed');
    });

    test('should skip duplicate prices within one minute', async () => {
      const existing = { price: 500000 };
      (mockRepository.findRecent as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      await priceHistoryService.recordPrice('https://jumia.com/test', 'jumia', 500000);

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getPriceHistory', () => {
    test('should retrieve price history for specific product and platform', async () => {
      const mockRecords = [
        { id: 1, productUrl: 'https://jumia.com/laptop-hp', platform: 'jumia', price: 500000, currency: 'NGN', recordedAt: new Date('2024-01-01') },
        { id: 2, productUrl: 'https://jumia.com/laptop-hp', platform: 'jumia', price: 480000, currency: 'NGN', recordedAt: new Date('2024-01-15') },
      ];
      (mockRepository.findHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecords);

      const result = await priceHistoryService.getPriceHistory('https://jumia.com/laptop-hp', 'jumia', 30);

      expect(result).toEqual(mockRecords);
      expect(mockRepository.findHistory).toHaveBeenCalledWith('https://jumia.com/laptop-hp', 'jumia', expect.any(Date));
    });

    test('should return empty array when no history exists', async () => {
      (mockRepository.findHistory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const result = await priceHistoryService.getPriceHistory('https://jumia.com/nonexistent', 'jumia', 30);
      expect(result).toEqual([]);
    });
  });

  describe('cleanupOldData', () => {
    test('should delete records older than 90 days', async () => {
      (mockRepository.deleteOlderThan as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 42 });
      const deletedCount = await priceHistoryService.cleanupOldData();
      expect(deletedCount).toBe(42);
      expect(mockRepository.deleteOlderThan).toHaveBeenCalledWith(expect.any(Date));
    });

    test('should return 0 when no old records exist', async () => {
      (mockRepository.deleteOlderThan as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
      expect(await priceHistoryService.cleanupOldData()).toBe(0);
    });

    test('should handle database errors during cleanup', async () => {
      (mockRepository.deleteOlderThan as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Database error during cleanup'));
      await expect(priceHistoryService.cleanupOldData()).rejects.toThrow('Database error during cleanup');
    });
  });
});
