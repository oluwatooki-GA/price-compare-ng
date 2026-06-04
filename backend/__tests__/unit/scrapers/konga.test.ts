import { describe, test, expect, beforeEach } from 'vitest';
import { KongaScraper } from '../../../src/scrapers/konga';

describe('KongaScraper', () => {
  let scraper: KongaScraper;

  beforeEach(() => {
    scraper = new KongaScraper();
  });

  describe('platformName', () => {
    test('returns correct platform name', () => {
      expect(scraper.platformName).toBe('konga');
    });
  });

  describe('isValidUrl', () => {
    test('accepts valid Konga URLs with www', () => {
      expect(scraper.isValidUrl('https://www.konga.com/product/item-123')).toBe(true);
    });

    test('accepts valid Konga URLs without www', () => {
      expect(scraper.isValidUrl('https://konga.com/product/item-123')).toBe(true);
    });

    test('rejects non-Konga URLs', () => {
      expect(scraper.isValidUrl('https://www.jumia.com.ng/product-123/')).toBe(false);
      expect(scraper.isValidUrl('https://www.amazon.com/product-123/')).toBe(false);
    });

    test('rejects invalid URLs', () => {
      expect(scraper.isValidUrl('not-a-url')).toBe(false);
      expect(scraper.isValidUrl('')).toBe(false);
    });
  });
});
