/**
 * Unit tests for Konga scraper
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { KongaScraper } from './konga';

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

  describe('price normalization', () => {
    test('normalizes price with naira symbol and commas', () => {
      // Access private method through type assertion for testing
      const normalizePrice = (scraper as any).normalizePrice.bind(scraper);
      
      expect(normalizePrice('₦ 1,234.56')).toBe(1234.56);
      expect(normalizePrice('₦1,234')).toBe(1234);
      expect(normalizePrice('₦ 1234')).toBe(1234);
    });

    test('normalizes price with NGN prefix', () => {
      const normalizePrice = (scraper as any).normalizePrice.bind(scraper);
      
      expect(normalizePrice('NGN 1234.56')).toBe(1234.56);
      expect(normalizePrice('NGN 1,234')).toBe(1234);
    });

    test('normalizes price with just numbers', () => {
      const normalizePrice = (scraper as any).normalizePrice.bind(scraper);
      
      expect(normalizePrice('1234.56')).toBe(1234.56);
      expect(normalizePrice('1,234')).toBe(1234);
    });

    test('returns null for invalid prices', () => {
      const normalizePrice = (scraper as any).normalizePrice.bind(scraper);
      
      expect(normalizePrice('')).toBeNull();
      expect(normalizePrice('invalid')).toBeNull();
      expect(normalizePrice('₦ 0')).toBeNull();
      expect(normalizePrice('₦ -100')).toBeNull();
    });
  });

  describe('rating extraction', () => {
    test('extracts rating from text', () => {
      const extractRating = (scraper as any).extractRating.bind(scraper);
      
      expect(extractRating('4.5 out of 5')).toBe(4.5);
      expect(extractRating('4.5')).toBe(4.5);
      expect(extractRating('3')).toBe(3);
    });

    test('returns null for invalid ratings', () => {
      const extractRating = (scraper as any).extractRating.bind(scraper);
      
      expect(extractRating('')).toBeNull();
      expect(extractRating('no rating')).toBeNull();
      expect(extractRating('6.0')).toBeNull(); // Out of range
    });
  });

  describe('review count extraction', () => {
    test('extracts review count from text', () => {
      const extractReviewCount = (scraper as any).extractReviewCount.bind(scraper);
      
      expect(extractReviewCount('(123)')).toBe(123);
      expect(extractReviewCount('123 reviews')).toBe(123);
      expect(extractReviewCount('123 ratings')).toBe(123);
    });

    test('returns 0 for no reviews', () => {
      const extractReviewCount = (scraper as any).extractReviewCount.bind(scraper);
      
      expect(extractReviewCount('')).toBe(0);
      expect(extractReviewCount('no reviews')).toBe(0);
    });
  });
});
