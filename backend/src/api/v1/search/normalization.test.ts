/**
 * Unit tests for NormalizationService
 * Tests similarity calculation, product grouping, and best value identification
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { NormalizationService } from './normalization';
import { ProductData } from '../../../scrapers/base';

describe('NormalizationService', () => {
  let service: NormalizationService;

  beforeEach(() => {
    service = new NormalizationService();
  });

  describe('calculateSimilarity', () => {
    test('identical names have similarity of 1.0', () => {
      const similarity = service.calculateSimilarity(
        'Samsung Galaxy S21',
        'Samsung Galaxy S21'
      );
      expect(similarity).toBe(1.0);
    });

    test('completely different names have low similarity', () => {
      const similarity = service.calculateSimilarity(
        'Samsung Galaxy S21',
        'iPhone 13 Pro Max'
      );
      expect(similarity).toBeLessThan(0.3);
    });

    test('similar product names have high similarity', () => {
      const similarity = service.calculateSimilarity(
        'Samsung Galaxy S21 Ultra',
        'Samsung Galaxy S21'
      );
      expect(similarity).toBeGreaterThan(0.6);
    });

    test('handles case insensitivity', () => {
      const similarity = service.calculateSimilarity(
        'SAMSUNG GALAXY S21',
        'samsung galaxy s21'
      );
      expect(similarity).toBe(1.0);
    });

    test('ignores common stop words', () => {
      const similarity1 = service.calculateSimilarity(
        'Samsung Galaxy S21',
        'The Samsung Galaxy S21'
      );
      expect(similarity1).toBe(1.0);
    });

    test('handles empty strings', () => {
      const similarity = service.calculateSimilarity('', '');
      expect(similarity).toBe(0);
    });

    test('handles special characters and punctuation', () => {
      const similarity = service.calculateSimilarity(
        'Samsung Galaxy S21 - 128GB (Black)',
        'Samsung Galaxy S21 128GB Black'
      );
      expect(similarity).toBe(1.0);
    });
  });

  describe('groupSimilarProducts', () => {
    test('groups similar products together', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21 128GB', 'jumia', 250000),
        createProduct('Samsung Galaxy S21 256GB', 'konga', 280000),
        createProduct('iPhone 13 Pro', 'jumia', 450000),
        createProduct('iPhone 13 Pro Max', 'konga', 500000)
      ];

      const results = service.groupSimilarProducts(products);

      // Should create 2 groups: Samsung products and iPhone products
      expect(results.length).toBe(2);
      
      // Each group should have 2 products
      expect(results[0].products.length).toBe(2);
      expect(results[1].products.length).toBe(2);
    });

    test('does not group dissimilar products', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000),
        createProduct('iPhone 13 Pro', 'konga', 450000),
        createProduct('Sony Headphones WH-1000XM4', 'jumia', 120000)
      ];

      const results = service.groupSimilarProducts(products);

      // Should create 3 separate groups
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.products.length).toBe(1);
      });
    });

    test('sets bestValueIndex correctly', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 280000),
        createProduct('Samsung Galaxy S21', 'konga', 250000) // Lower price
      ];

      const results = service.groupSimilarProducts(products);

      expect(results.length).toBe(1);
      expect(results[0].bestValueIndex).toBe(1); // Konga has lower price
    });

    test('handles empty product array', () => {
      const results = service.groupSimilarProducts([]);
      expect(results).toEqual([]);
    });

    test('handles single product', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000)
      ];

      const results = service.groupSimilarProducts(products);

      expect(results.length).toBe(1);
      expect(results[0].products.length).toBe(1);
      expect(results[0].bestValueIndex).toBe(0);
    });

    test('includes timestamp in results', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000)
      ];

      const results = service.groupSimilarProducts(products);

      expect(results[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('identifyBestValue', () => {
    test('selects product with lowest price', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 280000, 4.5, 100),
        createProduct('Samsung Galaxy S21', 'konga', 250000, 4.3, 80)
      ];

      const bestValue = service.identifyBestValue(products);

      expect(bestValue.platform).toBe('konga');
      expect(bestValue.price).toBe(250000);
    });

    test('considers rating when prices are within 5%', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000, 4.8, 100),
        createProduct('Samsung Galaxy S21', 'konga', 252000, 4.3, 80) // Within 5%
      ];

      const bestValue = service.identifyBestValue(products);

      // Jumia has better rating despite slightly higher price
      expect(bestValue.platform).toBe('jumia');
      expect(bestValue.rating).toBe(4.8);
    });

    test('considers review count when prices and ratings are similar', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000, 4.5, 150),
        createProduct('Samsung Galaxy S21', 'konga', 252000, 4.5, 80)
      ];

      const bestValue = service.identifyBestValue(products);

      // Jumia has more reviews
      expect(bestValue.platform).toBe('jumia');
      expect(bestValue.reviewCount).toBe(150);
    });

    test('handles null ratings', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000, null, 100),
        createProduct('Samsung Galaxy S21', 'konga', 252000, 4.5, 80)
      ];

      const bestValue = service.identifyBestValue(products);

      // Konga has a rating, Jumia doesn't
      expect(bestValue.platform).toBe('konga');
    });

    test('filters out unavailable products', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 200000, 4.5, 100, false), // Unavailable
        createProduct('Samsung Galaxy S21', 'konga', 250000, 4.3, 80, true)
      ];

      const bestValue = service.identifyBestValue(products);

      expect(bestValue.platform).toBe('konga');
      expect(bestValue.availability).toBe(true);
    });

    test('returns first product if all are unavailable', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000, 4.5, 100, false),
        createProduct('Samsung Galaxy S21', 'konga', 280000, 4.3, 80, false)
      ];

      const bestValue = service.identifyBestValue(products);

      expect(bestValue.platform).toBe('jumia');
    });

    test('returns single product', () => {
      const products: ProductData[] = [
        createProduct('Samsung Galaxy S21', 'jumia', 250000)
      ];

      const bestValue = service.identifyBestValue(products);

      expect(bestValue.platform).toBe('jumia');
    });

    test('throws error for empty array', () => {
      expect(() => service.identifyBestValue([])).toThrow(
        'Cannot identify best value from empty product list'
      );
    });
  });
});

/**
 * Helper function to create test product data
 */
function createProduct(
  name: string,
  platform: string,
  price: number,
  rating: number | null = 4.5,
  reviewCount: number = 100,
  availability: boolean = true
): ProductData {
  return {
    platform,
    name,
    price,
    currency: 'NGN',
    rating,
    reviewCount,
    url: `https://${platform}.com/product/${name.toLowerCase().replace(/\s+/g, '-')}`,
    availability,
    imageUrl: `https://${platform}.com/images/product.jpg`
  };
}
