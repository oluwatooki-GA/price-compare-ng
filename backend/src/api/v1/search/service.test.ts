/**
 * Unit tests for SearchService
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { SearchService } from './service';
import { ScraperRegistry } from '../../../scrapers/registry';
import { NormalizationService } from './normalization';
import { ScraperAdapter, ProductData } from '../../../scrapers/base';
import { ValidationError, ScrapingError } from '../../../shared/errors';
// import { RedisClientType } from 'redis'; // TODO: Re-enable when Redis caching is implemented
// import { PriceHistoryService } from '../comparisons/priceHistory'; // TODO: Re-enable when price history is implemented

// Mock Redis client
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(),
    quit: vi.fn(),
    get: vi.fn(),
    setEx: vi.fn(),
    on: vi.fn(),
    isOpen: false
  }))
}));

// Mock scraper for testing
class MockScraper extends ScraperAdapter {
  constructor(
    private _platformName: string,
    private _searchResults: ProductData[] = [],
    private _urlProduct: ProductData | null = null,
    private _shouldFail: boolean = false
  ) {
    super();
  }

  get platformName(): string {
    return this._platformName;
  }

  async searchProducts(_keyword: string, _maxResults?: number): Promise<ProductData[]> {
    if (this._shouldFail) {
      throw new Error('Scraper failed');
    }
    return this._searchResults;
  }

  async getProductByUrl(_url: string): Promise<ProductData> {
    if (this._shouldFail) {
      throw new Error('Scraper failed');
    }
    if (!this._urlProduct) {
      throw new Error('Product not found');
    }
    return this._urlProduct;
  }

  isValidUrl(url: string): boolean {
    return url.includes(this._platformName);
  }
}

describe('SearchService', () => {
  let searchService: SearchService;
  let scraperRegistry: ScraperRegistry;
  let normalizationService: NormalizationService;
  let mockPriceHistoryService: any;
  let mockRedisClient: any;

  beforeEach(() => {
    scraperRegistry = new ScraperRegistry();
    normalizationService = new NormalizationService();
    
    // Create mock PriceHistoryService
    mockPriceHistoryService = {
      recordPrice: vi.fn().mockResolvedValue(undefined),
      getPriceHistory: vi.fn().mockResolvedValue([]),
      cleanupOldData: vi.fn().mockResolvedValue(0)
    };
    
    // Create mock Redis client
    mockRedisClient = {
      connect: vi.fn(),
      quit: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      setEx: vi.fn().mockResolvedValue('OK'),
      on: vi.fn(),
      isOpen: false
    };

    searchService = new SearchService(
      scraperRegistry,
      normalizationService
      // mockPriceHistoryService as PriceHistoryService // TODO: Re-enable when price history is implemented
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('searchByKeyword', () => {
    test('should reject keywords shorter than 2 characters', async () => {
      await expect(searchService.searchByKeyword('')).rejects.toThrow(ValidationError);
      await expect(searchService.searchByKeyword('a')).rejects.toThrow(ValidationError);
      await expect(searchService.searchByKeyword(' ')).rejects.toThrow(ValidationError);
    });

    test('should throw error when no scrapers are registered', async () => {
      await expect(searchService.searchByKeyword('laptop')).rejects.toThrow(ScrapingError);
      await expect(searchService.searchByKeyword('laptop')).rejects.toThrow('No platform scrapers are registered');
    });

    test('should query all registered scrapers', async () => {
      const product1: ProductData = {
        platform: 'jumia',
        name: 'Laptop HP',
        price: 500000,
        currency: 'NGN',
        rating: 4.5,
        reviewCount: 100,
        url: 'https://jumia.com/laptop',
        availability: true,
        imageUrl: null
      };

      const product2: ProductData = {
        platform: 'jiji',
        name: 'Laptop HP',
        price: 480000,
        currency: 'NGN',
        rating: 4.3,
        reviewCount: 80,
        url: 'https://konga.com/laptop',
        availability: true,
        imageUrl: null
      };

      const jumiaScraper = new MockScraper('jumia', [product1]);
      const kongaScraper = new MockScraper('konga', [product2]);

      scraperRegistry.registerScraper(jumiaScraper);
      scraperRegistry.registerScraper(kongaScraper);

      const results = await searchService.searchByKeyword('laptop');

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].searchQuery).toBe('laptop');
    });

    test('should continue when one platform fails', async () => {
      const product: ProductData = {
        platform: 'jiji',
        name: 'Laptop HP',
        price: 480000,
        currency: 'NGN',
        rating: 4.3,
        reviewCount: 80,
        url: 'https://konga.com/laptop',
        availability: true,
        imageUrl: null
      };

      const failingScraper = new MockScraper('jumia', [], null, true);
      const workingScraper = new MockScraper('konga', [product]);

      scraperRegistry.registerScraper(failingScraper);
      scraperRegistry.registerScraper(workingScraper);

      const results = await searchService.searchByKeyword('laptop');

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].products).toContainEqual(expect.objectContaining({ platform: 'jiji' }));
    });

    test('should return empty array when no products found', async () => {
      const emptyScraper = new MockScraper('jumia', []);
      scraperRegistry.registerScraper(emptyScraper);

      const results = await searchService.searchByKeyword('nonexistent');

      expect(results).toEqual([]);
    });

    test('should use cached results when available', async () => {
      const product: ProductData = {
        platform: 'jumia',
        name: 'Laptop HP',
        price: 500000,
        currency: 'NGN',
        rating: 4.5,
        reviewCount: 100,
        url: 'https://jumia.com/laptop',
        availability: true,
        imageUrl: null
      };

      const cachedResults = [{
        products: [product],
        bestValueIndex: 0,
        searchQuery: 'laptop',
        timestamp: new Date()
      }];

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedResults));

      const results = await searchService.searchByKeyword('laptop');

      expect(results).toBeDefined();
      expect(results.length).toBe(1);
      expect(mockRedisClient.get).toHaveBeenCalledWith('search:keyword:laptop');
    });

    test('should record prices for all products found', async () => {
      const product1: ProductData = {
        platform: 'jumia',
        name: 'Laptop HP',
        price: 500000,
        currency: 'NGN',
        rating: 4.5,
        reviewCount: 100,
        url: 'https://jumia.com/laptop',
        availability: true,
        imageUrl: null
      };

      const product2: ProductData = {
        platform: 'temu',
        name: 'Laptop HP',
        price: 480000,
        currency: 'NGN',
        rating: 4.3,
        reviewCount: 80,
        url: 'https://konga.com/laptop',
        availability: true,
        imageUrl: null
      };

      const jumiaScraper = new MockScraper('jumia', [product1]);
      const kongaScraper = new MockScraper('konga', [product2]);

      scraperRegistry.registerScraper(jumiaScraper);
      scraperRegistry.registerScraper(kongaScraper);

      await searchService.searchByKeyword('laptop');

      // Verify recordPrice was called for each product
      expect(mockPriceHistoryService.recordPrice).toHaveBeenCalledTimes(2);
      expect(mockPriceHistoryService.recordPrice).toHaveBeenCalledWith(
        product1.url,
        product1.platform,
        product1.price,
        product1.currency
      );
      expect(mockPriceHistoryService.recordPrice).toHaveBeenCalledWith(
        product2.url,
        product2.platform,
        product2.price,
        product2.currency
      );
    });
  });

  describe('searchByUrl', () => {
    test('should reject invalid URLs', async () => {
      await expect(searchService.searchByUrl('not-a-url')).rejects.toThrow(ValidationError);
      await expect(searchService.searchByUrl('http://unsupported.com/product')).rejects.toThrow(ValidationError);
    });

    test('should extract product and search other platforms', async () => {
      const mainProduct: ProductData = {
        platform: 'jumia',
        name: 'Laptop HP Pavilion',
        price: 500000,
        currency: 'NGN',
        rating: 4.5,
        reviewCount: 100,
        url: 'https://jumia.com/laptop-hp',
        availability: true,
        imageUrl: null
      };

      const similarProduct: ProductData = {
        platform: 'jiji',
        name: 'Laptop HP Pavilion',
        price: 480000,
        currency: 'NGN',
        rating: 4.3,
        reviewCount: 80,
        url: 'https://konga.com/laptop-hp',
        availability: true,
        imageUrl: null
      };

      const jumiaScraper = new MockScraper('jumia', [], mainProduct);
      const kongaScraper = new MockScraper('konga', [similarProduct]);

      scraperRegistry.registerScraper(jumiaScraper);
      scraperRegistry.registerScraper(kongaScraper);

      const result = await searchService.searchByUrl('https://jumia.com/laptop-hp');

      expect(result).toBeDefined();
      expect(result.products.length).toBeGreaterThan(0);
      expect(result.products).toContainEqual(expect.objectContaining({ url: mainProduct.url }));
      expect(result.searchQuery).toBe('https://jumia.com/laptop-hp');
    });

    test('should handle scraping errors gracefully', async () => {
      const failingScraper = new MockScraper('jumia', [], null, true);
      scraperRegistry.registerScraper(failingScraper);

      await expect(searchService.searchByUrl('https://jumia.com/laptop')).rejects.toThrow(ScrapingError);
    });

    test('should return main product even when other platforms fail', async () => {
      const mainProduct: ProductData = {
        platform: 'jumia',
        name: 'Laptop HP',
        price: 500000,
        currency: 'NGN',
        rating: 4.5,
        reviewCount: 100,
        url: 'https://jumia.com/laptop',
        availability: true,
        imageUrl: null
      };

      const jumiaScraper = new MockScraper('jumia', [], mainProduct);
      const failingKongaScraper = new MockScraper('konga', [], null, true);

      scraperRegistry.registerScraper(jumiaScraper);
      scraperRegistry.registerScraper(failingKongaScraper);

      const result = await searchService.searchByUrl('https://jumia.com/laptop');

      expect(result).toBeDefined();
      expect(result.products).toContainEqual(expect.objectContaining({ url: mainProduct.url }));
    });

    test('should record prices for main product and similar products', async () => {
      const mainProduct: ProductData = {
        platform: 'jumia',
        name: 'Laptop HP Pavilion',
        price: 500000,
        currency: 'NGN',
        rating: 4.5,
        reviewCount: 100,
        url: 'https://jumia.com/laptop-hp',
        availability: true,
        imageUrl: null
      };

      const similarProduct: ProductData = {
        platform: 'temu',
        name: 'Laptop HP Pavilion',
        price: 480000,
        currency: 'NGN',
        rating: 4.3,
        reviewCount: 80,
        url: 'https://konga.com/laptop-hp',
        availability: true,
        imageUrl: null
      };

      const jumiaScraper = new MockScraper('jumia', [], mainProduct);
      const kongaScraper = new MockScraper('konga', [similarProduct]);

      scraperRegistry.registerScraper(jumiaScraper);
      scraperRegistry.registerScraper(kongaScraper);

      await searchService.searchByUrl('https://jumia.com/laptop-hp');

      // Verify recordPrice was called for main product and similar products
      expect(mockPriceHistoryService.recordPrice).toHaveBeenCalledTimes(2);
      expect(mockPriceHistoryService.recordPrice).toHaveBeenCalledWith(
        mainProduct.url,
        mainProduct.platform,
        mainProduct.price,
        mainProduct.currency
      );
      expect(mockPriceHistoryService.recordPrice).toHaveBeenCalledWith(
        similarProduct.url,
        similarProduct.platform,
        similarProduct.price,
        similarProduct.currency
      );
    });
  });

  describe('validateUrl', () => {
    test('should return false for invalid URL format', () => {
      const result = searchService.validateUrl('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.platform).toBeUndefined();
    });

    test('should return false for unsupported platforms', () => {
      const scraper = new MockScraper('jumia');
      scraperRegistry.registerScraper(scraper);

      const result = searchService.validateUrl('https://amazon.com/product');
      expect(result.isValid).toBe(false);
      expect(result.platform).toBeUndefined();
    });

    test('should return true with platform name for valid URLs', () => {
      const scraper = new MockScraper('jumia');
      scraperRegistry.registerScraper(scraper);

      const result = searchService.validateUrl('https://jumia.com/product');
      expect(result.isValid).toBe(true);
      expect(result.platform).toBe('jumia');
    });

    test('should check all registered scrapers', () => {
      const jumiaScraper = new MockScraper('jumia');
      const kongaScraper = new MockScraper('konga');

      scraperRegistry.registerScraper(jumiaScraper);
      scraperRegistry.registerScraper(kongaScraper);

      const jumiaResult = searchService.validateUrl('https://jumia.com/product');
      expect(jumiaResult.isValid).toBe(true);
      expect(jumiaResult.platform).toBe('jumia');

      const kongaResult = searchService.validateUrl('https://konga.com/product');
      expect(kongaResult.isValid).toBe(true);
      expect(kongaResult.platform).toBe('konga');
    });
  });

  describe('connect and disconnect', () => {
    test('should connect to Redis', async () => {
      await searchService.connect();
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    test('should disconnect from Redis', async () => {
      mockRedisClient.isOpen = true;
      await searchService.disconnect();
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    test('should not connect if already open', async () => {
      mockRedisClient.isOpen = true;
      await searchService.connect();
      expect(mockRedisClient.connect).not.toHaveBeenCalled();
    });

    test('should not disconnect if not open', async () => {
      mockRedisClient.isOpen = false;
      await searchService.disconnect();
      expect(mockRedisClient.quit).not.toHaveBeenCalled();
    });
  });
});
