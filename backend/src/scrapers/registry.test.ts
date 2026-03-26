/**
 * Tests for ScraperRegistry
 * Validates requirement 8.2: Platform extensibility
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ScraperRegistry } from './registry';
import { ScraperAdapter, ProductData } from './base';

// Mock scraper implementation for testing
class MockScraper extends ScraperAdapter {
  constructor(private _platformName: string) {
    super();
  }

  get platformName(): string {
    return this._platformName;
  }

  async searchProducts(_keyword: string, _maxResults?: number): Promise<ProductData[]> {
    return [];
  }

  async getProductByUrl(url: string): Promise<ProductData> {
    return {
      platform: this._platformName,
      name: 'Test Product',
      price: 100,
      currency: 'NGN',
      rating: 4.5,
      reviewCount: 10,
      url: url,
      availability: true,
      imageUrl: null
    };
  }

  isValidUrl(url: string): boolean {
    return url.includes(this._platformName);
  }
}

describe('ScraperRegistry', () => {
  let registry: ScraperRegistry;

  beforeEach(() => {
    registry = new ScraperRegistry();
  });

  describe('registerScraper', () => {
    test('should register a new scraper', () => {
      const scraper = new MockScraper('jumia');
      registry.registerScraper(scraper);

      expect(registry.getScraperCount()).toBe(1);
      expect(registry.hasPlatform('jumia')).toBe(true);
    });

    test('should register multiple scrapers', () => {
      const jumia = new MockScraper('jumia');
      const jiji = new MockScraper('jiji');

      registry.registerScraper(jumia);
      registry.registerScraper(jiji);

      expect(registry.getScraperCount()).toBe(2);
      expect(registry.hasPlatform('jumia')).toBe(true);
      expect(registry.hasPlatform('jiji')).toBe(true);
    });

    test('should throw error when registering duplicate platform', () => {
      const scraper1 = new MockScraper('jumia');
      const scraper2 = new MockScraper('jumia');

      registry.registerScraper(scraper1);

      expect(() => registry.registerScraper(scraper2)).toThrow(
        'Scraper for platform "jumia" is already registered'
      );
    });
  });

  describe('getAllScrapers', () => {
    test('should return empty array when no scrapers registered', () => {
      const scrapers = registry.getAllScrapers();
      expect(scrapers).toEqual([]);
    });

    test('should return all registered scrapers', () => {
      const jumia = new MockScraper('jumia');
      const jiji = new MockScraper('jiji');

      registry.registerScraper(jumia);
      registry.registerScraper(jiji);

      const scrapers = registry.getAllScrapers();
      expect(scrapers).toHaveLength(2);
      expect(scrapers).toContain(jumia);
      expect(scrapers).toContain(jiji);
    });
  });

  describe('getScraperByPlatform', () => {
    test('should return scraper for registered platform', () => {
      const scraper = new MockScraper('jumia');
      registry.registerScraper(scraper);

      const retrieved = registry.getScraperByPlatform('jumia');
      expect(retrieved).toBe(scraper);
    });

    test('should return undefined for unregistered platform', () => {
      const retrieved = registry.getScraperByPlatform('nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('hasPlatform', () => {
    test('should return true for registered platform', () => {
      const scraper = new MockScraper('jumia');
      registry.registerScraper(scraper);

      expect(registry.hasPlatform('jumia')).toBe(true);
    });

    test('should return false for unregistered platform', () => {
      expect(registry.hasPlatform('nonexistent')).toBe(false);
    });
  });

  describe('getScraperCount', () => {
    test('should return 0 when no scrapers registered', () => {
      expect(registry.getScraperCount()).toBe(0);
    });

    test('should return correct count after registrations', () => {
      registry.registerScraper(new MockScraper('jumia'));
      expect(registry.getScraperCount()).toBe(1);

      registry.registerScraper(new MockScraper('konga'));
      expect(registry.getScraperCount()).toBe(2);
    });
  });

  describe('clear', () => {
    test('should remove all registered scrapers', () => {
      registry.registerScraper(new MockScraper('jumia'));
      registry.registerScraper(new MockScraper('konga'));

      expect(registry.getScraperCount()).toBe(2);

      registry.clear();

      expect(registry.getScraperCount()).toBe(0);
      expect(registry.getAllScrapers()).toEqual([]);
    });
  });

  describe('integration scenarios', () => {
    test('should support dynamic platform addition', () => {
      // Initially register two platforms
      registry.registerScraper(new MockScraper('jumia'));
      registry.registerScraper(new MockScraper('konga'));

      expect(registry.getScraperCount()).toBe(2);

      // Add a new platform dynamically
      registry.registerScraper(new MockScraper('amazon'));

      expect(registry.getScraperCount()).toBe(3);
      expect(registry.hasPlatform('amazon')).toBe(true);

      // Verify all platforms are accessible
      const allScrapers = registry.getAllScrapers();
      expect(allScrapers).toHaveLength(3);
    });

    test('should maintain scraper functionality after registration', async () => {
      const scraper = new MockScraper('jumia');
      registry.registerScraper(scraper);

      const retrieved = registry.getScraperByPlatform('jumia');
      expect(retrieved).toBeDefined();

      // Verify scraper methods still work
      const product = await retrieved!.getProductByUrl('https://jumia.com/product');
      expect(product.platform).toBe('jumia');
      expect(product.name).toBe('Test Product');
    });
  });
});
