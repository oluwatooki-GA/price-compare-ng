import { describe, test, expect, beforeEach } from 'vitest';
import { NormalizationService } from '../../../src/api/v1/search/normalization';
import { ProductData } from '../../../src/scrapers/base';

describe('NormalizationService', () => {
  let service: NormalizationService;

  beforeEach(() => { service = new NormalizationService(); });

  describe('calculateSimilarity', () => {
    test('identical names have similarity of 1.0', () => {
      expect(service.calculateSimilarity('Samsung Galaxy S21', 'Samsung Galaxy S21')).toBe(1.0);
    });

    test('completely different names have low similarity', () => {
      expect(service.calculateSimilarity('Samsung Galaxy S21', 'iPhone 13 Pro Max')).toBeLessThan(0.3);
    });

    test('similar product names have high similarity', () => {
      expect(service.calculateSimilarity('Samsung Galaxy S21 Ultra', 'Samsung Galaxy S21')).toBeGreaterThan(0.6);
    });

    test('handles case insensitivity', () => {
      expect(service.calculateSimilarity('SAMSUNG GALAXY S21', 'samsung galaxy s21')).toBe(1.0);
    });

    test('ignores common stop words', () => {
      expect(service.calculateSimilarity('Samsung Galaxy S21', 'The Samsung Galaxy S21')).toBe(1.0);
    });

    test('handles empty strings', () => {
      expect(service.calculateSimilarity('', '')).toBe(0);
    });

    test('handles special characters and punctuation', () => {
      expect(service.calculateSimilarity('Samsung Galaxy S21 - 128GB (Black)', 'Samsung Galaxy S21 128GB Black')).toBe(1.0);
    });
  });

  describe('groupSimilarProducts', () => {
    test('returns each product as its own result', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21 128GB', 'jumia', 250000),
        createProduct('Samsung Galaxy S21 256GB', 'konga', 280000),
        createProduct('iPhone 13 Pro', 'jumia', 450000),
        createProduct('iPhone 13 Pro Max', 'konga', 500000),
      ];
      const results = service.groupSimilarProducts(products);
      expect(results.length).toBe(products.length);
      results.forEach(r => {
        expect(r.products.length).toBe(1);
        expect(r.bestValueIndex).toBe(0);
      });
    });

    test('removes price outliers', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000),
        createProduct('Samsung Galaxy S21', 'konga', 260000),
        createProduct('Samsung Galaxy S21', 'jiji', 255000),
        createProduct('Samsung Galaxy S21 Bundle', 'jumia', 10000000),
      ];
      const results = service.groupSimilarProducts(products);
      expect(results.length).toBe(3);
    });

    test('handles empty product array', () => {
      expect(service.groupSimilarProducts([])).toEqual([]);
    });

    test('handles single product', () => {
      const products: ProductData[] = [createProduct('Samsung Galaxy S21', 'jumia', 250000)];
      const results = service.groupSimilarProducts(products);
      expect(results.length).toBe(1);
      expect(results[0].products.length).toBe(1);
      expect(results[0].bestValueIndex).toBe(0);
    });

    test('includes timestamp in results', () => {
      const products: ProductData[] = [createProduct('Samsung Galaxy S21', 'jumia', 250000)];
      expect(service.groupSimilarProducts(products)[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('identifyBestValue', () => {
    test('selects product with lowest price', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 280000, 4.5, 100),
        createProduct('Samsung Galaxy S21', 'konga', 250000, 4.3, 80),
      ];
      const best = service.identifyBestValue(products);
      expect(best.platform).toBe('konga');
    });

    test('considers rating when prices are within 5%', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000, 4.8, 100),
        createProduct('Samsung Galaxy S21', 'konga', 252000, 4.3, 80),
      ];
      expect(service.identifyBestValue(products).platform).toBe('jumia');
    });

    test('considers review count when prices and ratings are similar', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000, 4.5, 150),
        createProduct('Samsung Galaxy S21', 'konga', 252000, 4.5, 80),
      ];
      expect(service.identifyBestValue(products).platform).toBe('jumia');
    });

    test('handles null ratings', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000, null, 100),
        createProduct('Samsung Galaxy S21', 'konga', 252000, 4.5, 80),
      ];
      expect(service.identifyBestValue(products).platform).toBe('konga');
    });

    test('filters out unavailable products', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 200000, 4.5, 100, false),
        createProduct('Samsung Galaxy S21', 'konga', 250000, 4.3, 80, true),
      ];
      expect(service.identifyBestValue(products).platform).toBe('konga');
    });

    test('returns first product if all are unavailable', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000, 4.5, 100, false),
        createProduct('Samsung Galaxy S21', 'konga', 280000, 4.3, 80, false),
      ];
      expect(service.identifyBestValue(products).platform).toBe('jumia');
    });

    test('returns single product', () => {
      const products: ProductData[] = [createProduct('Samsung Galaxy S21', 'jumia', 250000)];
      expect(service.identifyBestValue(products).platform).toBe('jumia');
    });

    test('throws error for empty array', () => {
      expect(() => service.identifyBestValue([])).toThrow('Cannot identify best value from empty product list');
    });
  });
});

function createProduct(name: string, platform: string, price: number, rating: number | null = 4.5, reviewCount = 100, availability = true): ProductData {
  return { platform, name, price, currency: 'NGN', rating, reviewCount, url: `https://${platform}.com/product/${name.toLowerCase().replace(/\s+/g, '-')}`, availability, imageUrl: `https://${platform}.com/images/product.jpg` };
}
