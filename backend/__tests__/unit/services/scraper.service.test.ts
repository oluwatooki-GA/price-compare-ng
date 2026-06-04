import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { SearchService } from '../../../src/services/ScraperService';
import { ScraperRegistry } from '../../../src/scrapers/registry';
import { NormalizationService } from '../../../src/api/v1/search/normalization';
import { ScraperAdapter, ProductData } from '../../../src/scrapers/base';
import { ValidationError, ScrapingError } from '../../../src/shared/errors';

// Use vi.hoisted so the same object is returned by createClient() AND referenced in assertions
const mockRedisClient = vi.hoisted(() => ({
  connect: vi.fn(),
  quit:    vi.fn(),
  get:     vi.fn().mockResolvedValue(null),
  setEx:   vi.fn().mockResolvedValue('OK'),
  on:      vi.fn(),
  isOpen:  false,
}));

vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedisClient),
}));

class MockScraper extends ScraperAdapter {
  constructor(
    private _platformName: string,
    private _searchResults: ProductData[] = [],
    private _urlProduct: ProductData | null = null,
    private _shouldFail = false,
  ) { super(); }

  get platformName(): string { return this._platformName; }

  async searchProducts(_keyword: string, _maxResults?: number): Promise<ProductData[]> {
    if (this._shouldFail) throw new Error('Scraper failed');
    return this._searchResults;
  }

  async getProductByUrl(_url: string): Promise<ProductData> {
    if (this._shouldFail) throw new Error('Scraper failed');
    if (!this._urlProduct) throw new Error('Product not found');
    return this._urlProduct;
  }

  isValidUrl(url: string): boolean { return url.includes(this._platformName); }
}

describe('SearchService (ScraperService)', () => {
  let searchService: SearchService;
  let scraperRegistry: ScraperRegistry;
  let normalizationService: NormalizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default return values wiped by clearAllMocks
    mockRedisClient.isOpen = false;
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.setEx.mockResolvedValue('OK');
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.quit.mockResolvedValue(undefined);   // must be a Promise so .catch() works
    scraperRegistry      = new ScraperRegistry();
    normalizationService = new NormalizationService();
    searchService = new SearchService(scraperRegistry, normalizationService);
  });

  afterEach(() => { vi.clearAllMocks(); });

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
      const product1: ProductData = { platform: 'jumia', name: 'Laptop HP', price: 500000, currency: 'NGN', rating: 4.5, reviewCount: 100, url: 'https://jumia.com/laptop', availability: true, imageUrl: null };
      const product2: ProductData = { platform: 'jiji',  name: 'Laptop HP', price: 480000, currency: 'NGN', rating: 4.3, reviewCount: 80,  url: 'https://konga.com/laptop', availability: true, imageUrl: null };
      scraperRegistry.registerScraper(new MockScraper('jumia', [product1]));
      scraperRegistry.registerScraper(new MockScraper('konga', [product2]));
      const results = await searchService.searchByKeyword('laptop');
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].searchQuery).toBe('laptop');
    });

    test('should continue when one platform fails', async () => {
      const product: ProductData = { platform: 'jiji', name: 'Laptop HP', price: 480000, currency: 'NGN', rating: 4.3, reviewCount: 80, url: 'https://konga.com/laptop', availability: true, imageUrl: null };
      scraperRegistry.registerScraper(new MockScraper('jumia', [], null, true));
      scraperRegistry.registerScraper(new MockScraper('konga', [product]));
      const results = await searchService.searchByKeyword('laptop');
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].products).toContainEqual(expect.objectContaining({ platform: 'jiji' }));
    });

    test('should return empty array when no products found', async () => {
      scraperRegistry.registerScraper(new MockScraper('jumia', []));
      const results = await searchService.searchByKeyword('nonexistent');
      expect(results).toEqual([]);
    });

    test('should use cached results when available', async () => {
      // Create a service with the redis client already attached so caching is active
      const serviceWithCache = new SearchService(scraperRegistry, normalizationService, mockRedisClient as any);
      const product: ProductData = { platform: 'jumia', name: 'Laptop HP', price: 500000, currency: 'NGN', rating: 4.5, reviewCount: 100, url: 'https://jumia.com/laptop', availability: true, imageUrl: null };
      const cachedResults = [{ products: [product], bestValueIndex: 0, searchQuery: 'laptop', timestamp: new Date() }];
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedResults));
      const results = await serviceWithCache.searchByKeyword('laptop');
      expect(results).toBeDefined();
      expect(results.length).toBe(1);
      // Cache key includes the serialised filters object
      expect(mockRedisClient.get).toHaveBeenCalledWith(expect.stringContaining('search:keyword:laptop'));
    });
  });

  describe('searchByUrl', () => {
    test('should reject invalid URLs', async () => {
      await expect(searchService.searchByUrl('not-a-url')).rejects.toThrow(ValidationError);
      await expect(searchService.searchByUrl('http://unsupported.com/product')).rejects.toThrow(ValidationError);
    });

    test('should extract product and search other platforms', async () => {
      const mainProduct: ProductData = { platform: 'jumia', name: 'Laptop HP Pavilion', price: 500000, currency: 'NGN', rating: 4.5, reviewCount: 100, url: 'https://jumia.com/laptop-hp', availability: true, imageUrl: null };
      const similarProduct: ProductData = { platform: 'jiji', name: 'Laptop HP Pavilion', price: 480000, currency: 'NGN', rating: 4.3, reviewCount: 80, url: 'https://konga.com/laptop-hp', availability: true, imageUrl: null };
      scraperRegistry.registerScraper(new MockScraper('jumia', [], mainProduct));
      scraperRegistry.registerScraper(new MockScraper('konga', [similarProduct]));
      const result = await searchService.searchByUrl('https://jumia.com/laptop-hp');
      expect(result).toBeDefined();
      expect(result.products).toContainEqual(expect.objectContaining({ url: mainProduct.url }));
      expect(result.searchQuery).toBe('https://jumia.com/laptop-hp');
    });

    test('should handle scraping errors gracefully', async () => {
      scraperRegistry.registerScraper(new MockScraper('jumia', [], null, true));
      await expect(searchService.searchByUrl('https://jumia.com/laptop')).rejects.toThrow(ScrapingError);
    });

    test('should return main product even when other platforms fail', async () => {
      const mainProduct: ProductData = { platform: 'jumia', name: 'Laptop HP', price: 500000, currency: 'NGN', rating: 4.5, reviewCount: 100, url: 'https://jumia.com/laptop', availability: true, imageUrl: null };
      scraperRegistry.registerScraper(new MockScraper('jumia', [], mainProduct));
      scraperRegistry.registerScraper(new MockScraper('konga', [], null, true));
      const result = await searchService.searchByUrl('https://jumia.com/laptop');
      expect(result.products).toContainEqual(expect.objectContaining({ url: mainProduct.url }));
    });
  });

  describe('validateUrl', () => {
    test('should return false for invalid URL format', () => {
      const result = searchService.validateUrl('not-a-url');
      expect(result.isValid).toBe(false);
    });

    test('should return false for unsupported platforms', () => {
      scraperRegistry.registerScraper(new MockScraper('jumia'));
      expect(searchService.validateUrl('https://amazon.com/product').isValid).toBe(false);
    });

    test('should return true with platform name for valid URLs', () => {
      scraperRegistry.registerScraper(new MockScraper('jumia'));
      const result = searchService.validateUrl('https://jumia.com/product');
      expect(result.isValid).toBe(true);
      expect(result.platform).toBe('jumia');
    });
  });

  describe('connect and disconnect', () => {
    test('should connect to Redis', async () => {
      await searchService.connect();
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    test('should disconnect from Redis', async () => {
      await searchService.connect(); // establish the connection first
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
