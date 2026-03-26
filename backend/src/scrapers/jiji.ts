import * as cheerio from 'cheerio';
import { ScraperAdapter, ProductData, SearchFilters } from './base';
import axios, { AxiosError } from 'axios';
import { RateLimiter, fetchWithRetry, DEFAULT_RATE_LIMIT_CONFIG } from './utils';
import { ScrapingError } from '../shared/errors';

export class JijiScraper extends ScraperAdapter {
  private rateLimiter: RateLimiter;
  private baseUrl = 'https://jiji.ng';

  constructor() {
    super();
    this.rateLimiter = new RateLimiter(DEFAULT_RATE_LIMIT_CONFIG);
  }

  get platformName(): string {
    return 'jiji';
  }

  isValidUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return u.hostname.endsWith('jiji.ng');
    } catch {
      return false;
    }
  }

  /**
   * Build a full Chrome/Android header set.
   * Cookie (JIJI_COOKIE env var) carries the Cloudflare cf_clearance token.
   * To refresh: DevTools → Network → find /api_web/v1/listing request → copy Cookie header.
   */
  private buildHeaders(referer: string): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36 Edg/145.0.0.0',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': referer,
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Sec-CH-UA': '"Not:A-Brand";v="99", "Microsoft Edge";v="145", "Chromium";v="145"',
      'Sec-CH-UA-Mobile': '?1',
      'Sec-CH-UA-Platform': '"Android"',
    };

    if (process.env.JIJI_COOKIE) {
      headers['Cookie'] = process.env.JIJI_COOKIE;
    }
    if (process.env.JIJI_PAGE_RID) {
      headers['x-page-rid'] = process.env.JIJI_PAGE_RID;
    }

    return headers;
  }

  async searchProducts(
    keyword: string,
    maxResults: number = 10,
    filters: SearchFilters = {}
  ): Promise<ProductData[]> {
    const encoded = encodeURIComponent(keyword);
    const referer = `${this.baseUrl}/search?query=${encoded}`;

    // Jiji API supports price range natively via query params
    let apiUrl =
      `${this.baseUrl}/api_web/v1/listing` +
      `?query=${encoded}&init_page=true&page=1&webp=true`;

    if (filters.minPrice !== undefined) {
      apiUrl += `&price_min=${filters.minPrice}`;
    }
    if (filters.maxPrice !== undefined) {
      apiUrl += `&price_max=${filters.maxPrice}`;
    }

    // ── Strategy 1: JSON API ────────────────────────────────────────────────
    try {
      await this.rateLimiter.waitIfNeeded();
      const response = await axios.get(apiUrl, {
        headers: this.buildHeaders(referer),
        timeout: 12000,
      });

      // adverts_list is an object: { adverts: [...], count, total_pages, ... }
      const ads = (
        response.data?.adverts_list?.adverts ??
        response.data?.data?.ads ??
        []
      ) as any[];

      if (Array.isArray(ads) && ads.length > 0) {
        const products: ProductData[] = [];

        for (const ad of ads.slice(0, maxResults)) {
          const name: string = ad?.title ?? '';
          const price: number = Number(ad?.price_obj?.value ?? ad?.price?.value ?? ad?.price) || 0;
          const slug: string = ad?.url ?? ad?.slug ?? '';
          const imageUrl: string | null = ad?.image_obj?.url ?? ad?.image?.url ?? ad?.img_url ?? null;

          if (!name || !price || !slug) continue;

          const cleanSlug = slug.split('?')[0];
          const fullUrl = cleanSlug.startsWith('http')
            ? cleanSlug
            : `${this.baseUrl}${cleanSlug.startsWith('/') ? '' : '/'}${cleanSlug}`;

          const product: ProductData = {
            platform: this.platformName,
            name,
            price,
            currency: 'NGN',
            rating: null,
            reviewCount: 0,
            url: fullUrl,
            availability: ad?.status === 'active',
            imageUrl,
          };

          // Jiji has no server-side rating — apply minRating post-fetch
          if (filters.minRating !== undefined && (product.rating ?? 0) < filters.minRating) {
            continue;
          }

          products.push(product);
        }

        if (products.length > 0) return products;
      }
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? (error as AxiosError).response?.status
        : undefined;
      console.error(
        `Jiji API failed (HTTP ${status ?? 'network error'}), falling back to HTML scraping`,
      );
    }

    // ── Strategy 2: HTML scraping fallback ─────────────────────────────────
    // Price range params on the search page URL
    let searchUrl = `${this.baseUrl}/search?query=${encoded}&page=1`;
    if (filters.minPrice !== undefined) searchUrl += `&price_min=${filters.minPrice}`;
    if (filters.maxPrice !== undefined) searchUrl += `&price_max=${filters.maxPrice}`;

    try {
      await this.rateLimiter.waitIfNeeded();
      const response = await axios.get<string>(searchUrl, {
        headers: this.buildHeaders(this.baseUrl),
        timeout: 12000,
      });

      const results = this.extractListings(response.data, maxResults, filters);
      if (results.length > 0) return results;

      const fallbackHtml = await fetchWithRetry(searchUrl, this.rateLimiter);
      return this.extractListings(fallbackHtml, maxResults, filters);
    } catch (error) {
      throw new ScrapingError(`Failed to search Jiji for "${keyword}": ${error}`);
    }
  }

  async getProductByUrl(url: string): Promise<ProductData> {
    if (!this.isValidUrl(url)) throw new ScrapingError(`Invalid Jiji URL: ${url}`);

    try {
      await this.rateLimiter.waitIfNeeded();
      const response = await axios.get<string>(url, {
        headers: this.buildHeaders(this.baseUrl),
        timeout: 12000,
      });
      const $ = cheerio.load(response.data);

      const name =
        $('h1').first().text().trim() ||
        $('[data-qa-id="ad-title"]').text().trim();
      if (!name) throw new ScrapingError('Product name not found');

      const priceText =
        $('[data-qa-id="ad-price"]').text().trim() ||
        $('[itemprop="price"]').text().trim();
      const price = this.normalizePrice(priceText);
      if (price === null) throw new ScrapingError('Product price not found or invalid');

      const imageUrl = $('img').first().attr('src') ?? null;

      return {
        platform: this.platformName,
        name,
        price,
        currency: 'NGN',
        rating: null,
        reviewCount: 0,
        url,
        availability: true,
        imageUrl,
      };
    } catch (error) {
      if (error instanceof ScrapingError) throw error;
      throw new ScrapingError(`Failed to extract product from Jiji URL: ${error}`);
    }
  }

  private extractListings(
    html: string,
    maxResults: number,
    filters: SearchFilters = {}
  ): ProductData[] {
    const $ = cheerio.load(html);
    const products: ProductData[] = [];

    $('[data-qa-id="aditem"]').each((_i, el): boolean | void => {
      if (products.length >= maxResults) return false;

      const card = $(el);
      const relative = card.find('a').first().attr('href');
      if (!relative) return;

      const url = relative.startsWith('http')
        ? relative
        : `${this.baseUrl}${relative}`;

      const name =
        card.find('[data-qa-id="ad-title"]').text().trim() ||
        card.find('h4, h3').first().text().trim();
      if (!name) return;

      const priceText = card.find('[data-qa-id="ad-price"]').text().trim();
      const price = this.normalizePrice(priceText);
      if (price === null) return;

      // Apply price filters when HTML scraping (API path already filtered via URL params)
      if (filters.minPrice !== undefined && price < filters.minPrice) return;
      if (filters.maxPrice !== undefined && price > filters.maxPrice) return;

      const imageUrl =
        card.find('img').first().attr('src') ??
        card.find('img').first().attr('data-src') ??
        null;

      products.push({
        platform: this.platformName,
        name,
        price,
        currency: 'NGN',
        rating: null,
        reviewCount: 0,
        url,
        availability: true,
        imageUrl,
      });
    });

    return products;
  }

  private normalizePrice(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[₦NGN,\s]/gi, '').trim();
    const val = parseFloat(cleaned);
    if (Number.isNaN(val) || val <= 0) return null;
    return val;
  }
}
