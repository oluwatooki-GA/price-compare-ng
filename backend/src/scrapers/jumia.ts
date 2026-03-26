/**
 * Jumia scraper implementation
 * Requirements 4.1, 4.2: Extract product data and normalize prices
 */

import * as cheerio from 'cheerio';
import { ScraperAdapter, ProductData, SearchFilters } from './base';
import { RateLimiter, fetchWithRetry, DEFAULT_RATE_LIMIT_CONFIG } from './utils';
import { ScrapingError } from '../shared/errors';

/**
 * Scraper implementation for Jumia.com.ng
 */
export class JumiaScraper extends ScraperAdapter {
  private rateLimiter: RateLimiter;
  private baseUrl = 'https://www.jumia.com.ng';

  constructor() {
    super();
    this.rateLimiter = new RateLimiter(DEFAULT_RATE_LIMIT_CONFIG);
  }

  get platformName(): string {
    return 'jumia';
  }

  isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'www.jumia.com.ng' || urlObj.hostname === 'jumia.com.ng';
    } catch {
      return false;
    }
  }

  /**
   * Search Jumia for products matching the keyword.
   *
   * Price range: Jumia's catalog URL supports ?price_min and ?price_max natively,
   * so those are passed as query params. minRating is applied post-fetch since
   * Jumia has no server-side rating filter.
   */
  async searchProducts(
      keyword: string,
      maxResults: number = 10,
      filters: SearchFilters = {}
  ): Promise<ProductData[]> {
    let searchUrl = `${this.baseUrl}/catalog/?q=${encodeURIComponent(keyword)}`;

    // Jumia supports native price range filtering via URL params
    if (filters.minPrice !== undefined) searchUrl += `&price_min=${filters.minPrice}`;
    if (filters.maxPrice !== undefined) searchUrl += `&price_max=${filters.maxPrice}`;

    try {
      const html = await fetchWithRetry(searchUrl, this.rateLimiter);
      const $ = cheerio.load(html);
      const products: ProductData[] = [];

      $('article.prd').each((_index, element) => {
        if (products.length >= maxResults) return false;

        try {
          const $product = $(element);

          const relativeUrl = $product.find('a.core').attr('href');
          if (!relativeUrl) return undefined;
          const productUrl = relativeUrl.startsWith('http')
              ? relativeUrl
              : `${this.baseUrl}${relativeUrl}`;

          const name = $product.find('h3.name').text().trim();
          if (!name) return undefined;

          const priceText = $product.find('div.prc').text().trim();
          const price = this.normalizePrice(priceText);
          if (price === null) return undefined;

          // Post-fetch price safety net (in case Jumia ignores the params)
          if (filters.minPrice !== undefined && price < filters.minPrice) return undefined;
          if (filters.maxPrice !== undefined && price > filters.maxPrice) return undefined;

          const ratingText = $product.find('div.stars._s').text().trim();
          const rating = this.extractRating(ratingText);

          // Post-fetch rating filter
          if (filters.minRating !== undefined && (rating ?? 0) < filters.minRating) {
            return undefined;
          }

          const reviewText = $product.find('div.rev').text().trim();
          const reviewCount = this.extractReviewCount(reviewText);

          const imageUrl =
              $product.find('img.img').attr('data-src') ||
              $product.find('img.img').attr('src') ||
              null;

          const availability = !$product.find('.tag._out-of-stock').length;

          products.push({
            platform: this.platformName,
            name,
            price,
            currency: 'NGN',
            rating,
            reviewCount,
            url: productUrl,
            availability,
            imageUrl,
          });
        } catch (error) {
          console.error(`Error parsing Jumia product: ${error}`);
        }
        return undefined;
      });

      return products;
    } catch (error) {
      if (error instanceof ScrapingError) throw error;
      throw new ScrapingError(`Failed to search Jumia: ${error}`);
    }
  }

  async getProductByUrl(url: string): Promise<ProductData> {
    if (!this.isValidUrl(url)) {
      throw new ScrapingError(`Invalid Jumia URL: ${url}`);
    }

    try {
      const html = await fetchWithRetry(url, this.rateLimiter);
      const $ = cheerio.load(html);

      // Name: product title is in <h1> on Jumia product pages
      const name = $('h1').first().text().trim();
      if (!name) throw new ScrapingError('Product name not found');

      // Price: most reliable source is <meta itemprop="price" content="250000">
      // Fall back to collecting ₦-prefixed text nodes, filtering out small
      // shipping fees (< ₦10,000), and taking the largest remaining value.
      let price: number | null = null;

      const metaPrice = $('meta[itemprop="price"]').attr('content');
      if (metaPrice) {
        const parsed = parseFloat(metaPrice);
        if (!isNaN(parsed) && parsed > 0) price = parsed;
      }

      if (price === null) {
        const candidates: number[] = [];
        $('*').contents().each((_i, node) => {
          if (node.type === 'text') {
            const t = ((node as any).data ?? '').trim();
            if (t.startsWith('\u20a6') || t.startsWith('N')) {
              const v = this.normalizePrice(t);
              if (v !== null && v >= 10_000) candidates.push(v);
            }
          }
        });
        // Take the most common value (product price appears multiple times,
        // shipping fee appears once)
        if (candidates.length > 0) {
          const freq = candidates.reduce((m, v) => {
            m.set(v, (m.get(v) ?? 0) + 1);
            return m;
          }, new Map<number, number>());
          price = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
        }
      }

      if (price === null) throw new ScrapingError('Product price not found or invalid');

      // Rating: "4.3 out of 5" text pattern
      const ratingText =
          $('[data-testid="product-rating"]').first().text().trim() ||
          $('.stars._m').first().text().trim() ||
          $('.-stars').first().text().trim();
      const rating = this.extractRating(ratingText);

      // Review count: "(3 verified ratings)"
      const reviewText =
          $('[data-testid="product-reviews-count"]').first().text().trim() ||
          $('a[href*="ratings"]').first().text().trim() ||
          $('a[href*="reviews"]').first().text().trim();
      const reviewCount = this.extractReviewCount(reviewText);

      const imageUrl =
          $('img[data-src]').first().attr('data-src') ||
          $('img.img').first().attr('src') ||
          null;

      const bodyText = $('body').text().toLowerCase();
      const availability =
          !bodyText.includes('out of stock') &&
          !bodyText.includes('unavailable');

      return {
        platform: this.platformName,
        name,
        price,
        currency: 'NGN',
        rating,
        reviewCount,
        url,
        availability,
        imageUrl,
      };
    } catch (error) {
      if (error instanceof ScrapingError) throw error;
      throw new ScrapingError(`Failed to extract product from URL: ${error}`);
    }
  }

  /**
   * Normalize price string to a numeric value.
   * Handles: "₦ 1,234.56", "NGN 1234.56", "1,234", "₦1234"
   */
  private normalizePrice(priceText: string): number | null {
    if (!priceText) return null;
    const cleaned = priceText
        .replace(/[₦NGN]/gi, '')
        .replace(/\s+/g, '')
        .replace(/,/g, '')
        .trim();
    const price = parseFloat(cleaned);
    return isNaN(price) || price <= 0 ? null : price;
  }

  private extractRating(ratingText: string): number | null {
    if (!ratingText) return null;
    const match = ratingText.match(/(\d+\.?\d*)/);
    if (match) {
      const rating = parseFloat(match[1]);
      if (!isNaN(rating) && rating >= 0 && rating <= 5) return rating;
    }
    return null;
  }

  private extractReviewCount(reviewText: string): number {
    if (!reviewText) return 0;
    const match = reviewText.match(/(\d+)/);
    if (match) {
      const count = parseInt(match[1], 10);
      if (!isNaN(count) && count >= 0) return count;
    }
    return 0;
  }
}
