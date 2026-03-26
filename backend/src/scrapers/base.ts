/**
 * Base interfaces and abstract class for platform scrapers
 * Requirement 8.1: Platform adapter interface for extensibility
 */

/**
 * Product data structure returned by all scrapers
 */
export interface ProductData {
  platform: string;
  name: string;
  price: number;
  currency: string;
  rating: number | null;
  reviewCount: number;
  url: string;
  availability: boolean;
  imageUrl: string | null;
}

/**
 * Optional filters that can be passed to scraper search methods.
 * Scrapers should apply these natively where the platform API supports it,
 * and fall back to post-fetch filtering for fields the API does not support.
 */
export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
}

/**
 * Abstract base class for platform-specific scrapers
 * All platform adapters must extend this class and implement its abstract methods
 */
export abstract class ScraperAdapter {
  /**
   * Return the platform identifier (e.g., 'jumia', 'konga')
   */
  abstract get platformName(): string;

  /**
   * Search the platform for products matching the keyword
   * @param keyword - Search term
   * @param maxResults - Maximum number of results to return (optional)
   * @param filters - Optional price / rating filters (optional)
   * @returns Array of product data
   */
  abstract searchProducts(
      keyword: string,
      maxResults?: number,
      filters?: SearchFilters
  ): Promise<ProductData[]>;

  /**
   * Extract product data from a specific product URL
   * @param url - Product page URL
   * @returns Product data
   */
  abstract getProductByUrl(url: string): Promise<ProductData>;

  /**
   * Check if a URL belongs to this platform
   * @param url - URL to validate
   * @returns True if URL belongs to this platform
   */
  abstract isValidUrl(url: string): boolean;
}
