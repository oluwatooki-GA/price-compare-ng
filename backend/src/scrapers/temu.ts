// import * as cheerio from 'cheerio'; // TODO: Re-enable when Temu scraper is implemented
import { ScraperAdapter, ProductData, SearchFilters } from './base';
import axios, { AxiosError } from 'axios';
// import { RateLimiter, DEFAULT_RATE_LIMIT_CONFIG } from './utils'; // TODO: Re-enable when Temu scraper is implemented
import { ScrapingError } from '../shared/errors';

/**
 * TemuScraper
 *
 * Temu is a fully client-side SPA — no SSR HTML to scrape.
 * searchProducts calls their internal XHR API (POST /api/poppy/v1/search).
 *
 * Price range: Temu's search API does not expose server-side price filters,
 * so minPrice/maxPrice are applied post-fetch.
 * minRating is also applied post-fetch.
 */
export class TemuScraper extends ScraperAdapter {
  // private rateLimiter: RateLimiter; // TODO: Re-enable when Temu scraper is implemented
  private readonly baseUrl = 'https://www.temu.com';
  private readonly apiUrl = 'https://www.temu.com/api/poppy/v1/search';

  constructor() {
    super();
    // this.rateLimiter = new RateLimiter({ requestsPerSecond: 1 }); // TODO: Re-enable when Temu scraper is implemented
  }

  get platformName(): string {
    return 'temu';
  }

  isValidUrl(url: string): boolean {
    try {
      return new URL(url).hostname.endsWith('temu.com');
    } catch {
      return false;
    }
  }

  private get requestHeaders(): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/json',
      'Origin': this.baseUrl,
      'Referer': `${this.baseUrl}/`,
      'Sec-CH-UA': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };
  }

  async searchProducts(
    keyword: string,
    maxResults: number = 10,
    filters: SearchFilters = {}
  ): Promise<ProductData[]> {
    // await this.rateLimiter.waitIfNeeded(); // TODO: Re-enable when Temu scraper is implemented

    const payload = {
      keyword,
      list_id: `${Date.now()}`,
      offset: 0,
      limit: Math.min(maxResults * 3, 60), // fetch more to allow post-fetch filtering
      sort_type: 0,
      search_method: 'user',
      page_sn: 10009,
    };

    try {
      const response = await axios.post(this.apiUrl, payload, {
        headers: this.requestHeaders,
        timeout: 15000,
      });

      const goodsList: any[] =
        response.data?.result?.goods_list ??
        response.data?.data?.goods_list ??
        [];

      if (!Array.isArray(goodsList) || goodsList.length === 0) {
        console.warn(
          `Temu API returned 0 results for "${keyword}". ` +
          'The endpoint or payload may have changed — inspect a live XHR request to verify.',
        );
        return [];
      }

      const results: ProductData[] = [];

      for (const item of goodsList) {
        if (results.length >= maxResults) break;

        const name: string = item?.goods_name ?? item?.display_name ?? '';
        if (!name) continue;

        const rawPrice: number = Number(
          item?.price_info?.price ??
          item?.price_info?.original_price ??
          item?.sell_price ??
          0,
        );
        const currency: string = item?.price_info?.currency ?? 'NGN';
        const price = this.normalizePrice(rawPrice, currency);
        if (price === null) continue;

        // Post-fetch price filtering
        if (filters.minPrice !== undefined && price < filters.minPrice) continue;
        if (filters.maxPrice !== undefined && price > filters.maxPrice) continue;

        const rating: number | null = item?.goods_rating ?? item?.star ?? null;
        const reviewCount: number = Number(item?.goods_comment_num ?? item?.comment_num ?? 0);

        // Post-fetch rating filtering
        if (filters.minRating !== undefined && (rating ?? 0) < filters.minRating) continue;

        const slugOrId: string = item?.goods_url_suffix ?? item?.link_url ?? '';
        const url = slugOrId.startsWith('http')
          ? slugOrId
          : `${this.baseUrl}${slugOrId.startsWith('/') ? '' : '/'}${slugOrId}`;

        const imageUrl: string | null =
          item?.thumb_url ?? item?.goods_image ?? item?.main_image ?? null;

        results.push({
          platform: this.platformName,
          name,
          price,
          currency,
          rating,
          reviewCount,
          url,
          availability: (item?.stock_status ?? 'in_stock') !== 'out_of_stock',
          imageUrl,
        } satisfies ProductData);
      }

      return results;
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? (error as AxiosError).response?.status
        : undefined;

      throw new ScrapingError(
        `Temu search failed (HTTP ${status ?? 'network error'}) for "${keyword}": ${error}`,
      );
    }
  }

  async getProductByUrl(url: string): Promise<ProductData> {
    if (!this.isValidUrl(url)) throw new ScrapingError(`Invalid Temu URL: ${url}`);

    const goodsId = this.extractGoodsId(url);
    if (!goodsId) throw new ScrapingError(`Cannot extract goods_id from URL: ${url}`);

    // await this.rateLimiter.waitIfNeeded(); // TODO: Re-enable when Temu scraper is implemented

    try {
      const response = await axios.get(
        `${this.baseUrl}/api/poppy/v1/goods_detail`,
        {
          params: { goods_id: goodsId },
          headers: { ...this.requestHeaders, 'Referer': url },
          timeout: 15000,
        },
      );

      const item: any =
        response.data?.result?.goods_detail ??
        response.data?.data ??
        response.data;

      const name: string = item?.goods_name ?? item?.title ?? '';
      if (!name) throw new ScrapingError('Product name not found in Temu response');

      const rawPrice: number = Number(
        item?.price_info?.price ??
        item?.price_info?.original_price ??
        item?.sell_price ??
        0,
      );
      const currency: string = item?.price_info?.currency ?? 'NGN';
      const price = this.normalizePrice(rawPrice, currency);
      if (price === null) throw new ScrapingError('Product price not found or invalid');

      const imageUrl: string | null = item?.images?.[0] ?? item?.thumb_url ?? null;
      const rating: number | null = item?.goods_rating ?? null;
      const reviewCount: number = Number(item?.goods_comment_num ?? 0);

      return {
        platform: this.platformName,
        name,
        price,
        currency,
        rating,
        reviewCount,
        url,
        availability: (item?.stock_status ?? 'in_stock') !== 'out_of_stock',
        imageUrl,
      };
    } catch (error) {
      if (error instanceof ScrapingError) throw error;
      throw new ScrapingError(`Failed to fetch Temu product at ${url}: ${error}`);
    }
  }

  private extractGoodsId(url: string): string | null {
    const paramMatch = url.match(/[?&]goods_id=(\d+)/);
    if (paramMatch) return paramMatch[1];
    const slugMatch = url.match(/-g-(\d+)\.html/);
    if (slugMatch) return slugMatch[1];
    return null;
  }

  private normalizePrice(rawPrice: number, currency: string): number | null {
    if (!rawPrice || rawPrice <= 0) return null;
    if (currency === 'NGN' && rawPrice > 100_000) return rawPrice / 100;
    return rawPrice;
  }
}