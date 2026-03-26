import * as cheerio from 'cheerio';
import { ScraperAdapter, ProductData, SearchFilters } from './base';
import axios, { AxiosError } from 'axios';
import { RateLimiter, DEFAULT_RATE_LIMIT_CONFIG, withRetry, DEFAULT_RETRY_CONFIG } from './utils';
import { ScrapingError } from '../shared/errors';

const IMAGE_BASE_URL =
    'https://www-konga-com-res.cloudinary.com/w_auto,f_auto,fl_lossy,dpr_auto,q_auto/media/catalog/product';

/**
 * Konga scraper
 *
 * searchProducts  — GraphQL API (api.konga.com/v1/graphql), no auth needed.
 *                   Price range is passed as numericFilters natively.
 *                   minRating applied post-fetch (no server-side support).
 *
 * getProductByUrl — HTML scraping of fully SSR Next.js product pages.
 */

function buildSearchQuery(
    keyword: string,
    page: number,
    limit: number,
    minPrice?: number,
    maxPrice?: number,
): string {
  const escaped = keyword.replace(/"/g, '\\"');

  // Build numericFilters array — same format as the Konga frontend uses
  const numericFilters: string[] = [];
  if (minPrice !== undefined) numericFilters.push(`price>=${minPrice}`);
  if (maxPrice !== undefined) numericFilters.push(`price<=${maxPrice}`);

  const filtersStr = numericFilters.map(f => `"${f}"`).join(', ');

  return `{
    searchByStore(
      search_term: []
      numericFilters: [${filtersStr}]
      sortBy: ""
      query: "${escaped}"
      paginate: { page: ${page}, limit: ${limit} }
      store_id: 1
    ) {
      pagination { limit page total }
      products {
        name
        product_id
        url_key
        price
        special_price
        deal_price
        final_price
        original_price
        image_thumbnail_path
        stock { in_stock quantity }
        product_rating {
          quality { average number_of_ratings }
        }
      }
    }
  }`;
}

export class KongaScraper extends ScraperAdapter {
  private rateLimiter: RateLimiter;
  private readonly baseUrl = 'https://www.konga.com';
  private readonly apiUrl = 'https://api.konga.com/v1/graphql';

  constructor() {
    super();
    this.rateLimiter = new RateLimiter(DEFAULT_RATE_LIMIT_CONFIG);
  }

  get platformName(): string {
    return 'konga';
  }

  isValidUrl(url: string): boolean {
    try {
      return new URL(url).hostname.endsWith('konga.com');
    } catch {
      return false;
    }
  }

  // ── Search (GraphQL API) ──────────────────────────────────────────────────

  async searchProducts(
      keyword: string,
      maxResults: number = 10,
      filters: SearchFilters = {}
  ): Promise<ProductData[]> {
    await this.rateLimiter.waitIfNeeded();

    const page = 0;
    const limit = Math.min(maxResults, 40);

    try {
      const response = await withRetry(
          () =>
              axios.post(
                  this.apiUrl,
                  {
                    query: buildSearchQuery(
                        keyword,
                        page,
                        limit,
                        filters.minPrice,
                        filters.maxPrice,
                    ),
                  },
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Origin': this.baseUrl,
                      'Referer': `${this.baseUrl}/`,
                    },
                    timeout: 15000,
                  },
              ),
          DEFAULT_RETRY_CONFIG,
      );

      const products: any[] =
          response.data?.data?.searchByStore?.products ?? [];

      if (!Array.isArray(products) || products.length === 0) {
        return [];
      }

      return products.slice(0, maxResults).flatMap(item => {
        const mapped = this.mapSearchProduct(item);
        if (!mapped) return [];
        // minRating applied post-fetch — Konga has no server-side rating filter
        if (
            filters.minRating !== undefined &&
            (mapped.rating ?? 0) < filters.minRating
        ) {
          return [];
        }
        return [mapped];
      });
    } catch (error) {
      const status = axios.isAxiosError(error)
          ? (error as AxiosError).response?.status
          : undefined;
      throw new ScrapingError(
          `Konga search failed (HTTP ${status ?? 'network error'}) for "${keyword}": ${error}`,
      );
    }
  }

  // ── Product by URL ────────────────────────────────────────────────────────
  // Konga is Next.js — all product data is embedded in <script id="__NEXT_DATA__">
  // as JSON. This is far more reliable than HTML selectors.

  async getProductByUrl(url: string): Promise<ProductData> {
    if (!this.isValidUrl(url)) throw new ScrapingError(`Invalid Konga URL: ${url}`);

    await this.rateLimiter.waitIfNeeded();

    let html: string;
    try {
      html = await withRetry(
          () =>
              axios
                  .get<string>(url, {
                    headers: {
                      'User-Agent':
                          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                      'Accept': 'text/html,application/xhtml+xml,*/*',
                      'Accept-Language': 'en-US,en;q=0.9',
                    },
                    timeout: 15000,
                  })
                  .then(r => r.data),
          DEFAULT_RETRY_CONFIG,
      );
    } catch (error) {
      throw new ScrapingError(`Failed to fetch Konga product page at ${url}: ${error}`);
    }

    const $ = cheerio.load(html);

    // ── Primary: parse __NEXT_DATA__ JSON (Next.js SSR data blob) ──────────
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        // Konga stores product info at props.pageProps.product or
        // props.pageProps.initialState.product depending on the page version
        const product =
            nextData?.props?.pageProps?.product ??
            nextData?.props?.pageProps?.initialState?.product ??
            nextData?.props?.pageProps?.data?.product;

        if (product) {
          const name: string = product.name ?? product.title ?? '';
          if (!name) throw new ScrapingError('Product name not found in __NEXT_DATA__');

          // special_price is the discounted price, price is RRP
          const price: number =
              Number(product.special_price || product.price) || 0;
          if (price <= 0) throw new ScrapingError('Product price not found in __NEXT_DATA__');

          const imagePath: string = product.image_thumbnail_path ?? product.image ?? '';
          const imageUrl: string | null = imagePath
              ? `${IMAGE_BASE_URL}${imagePath}`
              : null;

          const rating: number | null =
              (product.product_rating?.quality?.average ?? 0) > 0
                  ? product.product_rating.quality.average
                  : null;

          const reviewCount: number =
              Number(product.product_rating?.quality?.number_of_ratings ?? 0);

          return {
            platform: this.platformName,
            name,
            price,
            currency: 'NGN',
            rating,
            reviewCount,
            url,
            availability: product.stock?.in_stock ?? true,
            imageUrl,
          };
        }
      } catch (e) {
        if (e instanceof ScrapingError) throw e;
        // JSON parse or path access failed — fall through to HTML scraping
        console.warn('Konga __NEXT_DATA__ parse failed, falling back to HTML:', e);
      }
    }

    // ── Fallback: HTML scraping ─────────────────────────────────────────────
    // Name: h3 is the product name; h1 is the category heading — skip h1
    const name =
        $('h3').first().text().trim() ||
        $('h4').eq(1).text().trim();

    if (!name) throw new ScrapingError('Product name not found on Konga page');

    // Prices: collect ₦-prefixed text nodes, deduplicate, sort — lowest = sale price
    const priceTexts: string[] = [];
    $('*').contents().each((_i, node) => {
      if (node.type === 'text') {
        const t = ((node as any).data ?? '').trim();
        if (t.startsWith('₦') && t.length > 1) priceTexts.push(t);
      }
    });

    const parsedPrices = [...new Set(priceTexts)]
        .map(t => this.parsePrice(t))
        .filter((n): n is number => n !== null && n > 0)
        .sort((a, b) => a - b);

    if (parsedPrices.length === 0) {
      throw new ScrapingError('Product price not found on Konga page');
    }

    const price = parsedPrices[0];

    let imageUrl: string | null = null;
    $('img').each((_i, el): boolean | void => {
      if (imageUrl) return false;
      const src = $(el).attr('src') ?? '';
      if (src.includes('cloudinary.com') && src.includes('catalog/product')) {
        imageUrl = src;
      }
    });

    let rating: number | null = null;
    let reviewCount = 0;
    $('*').contents().each((_i, node) => {
      if (node.type !== 'text') return;
      const t = ((node as any).data ?? '').trim();
      if (rating === null) {
        const m = t.match(/^(\d+(\.\d+)?)\/5$/);
        if (m) rating = parseFloat(m[1]);
      }
      const rm = t.match(/Merchant Reviews\s*\((\d+)\)/i);
      if (rm) reviewCount = parseInt(rm[1], 10);
    });

    return {
      platform: this.platformName,
      name,
      price,
      currency: 'NGN',
      rating,
      reviewCount,
      url,
      availability: !$('body').text().toLowerCase().includes('out of stock'),
      imageUrl,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private parsePrice(text: string): number | null {
    const cleaned = text.replace(/[₦,\s]/g, '').trim();
    const val = parseFloat(cleaned);
    return Number.isNaN(val) || val <= 0 ? null : val;
  }

  private mapSearchProduct(item: any): ProductData | null {
    const name: string = item?.name ?? '';
    if (!name) return null;

    const effectivePrice: number =
        Number(item?.special_price || item?.deal_price || item?.final_price || item?.price) || 0;
    if (effectivePrice <= 0) return null;

    const urlKey: string = item?.url_key ?? '';
    const url = urlKey ? `${this.baseUrl}/product/${urlKey}` : this.baseUrl;

    const imagePath: string = item?.image_thumbnail_path ?? '';
    const imageUrl: string | null = imagePath
        ? `${IMAGE_BASE_URL}${imagePath}`
        : null;

    const rating: number | null =
        (item?.product_rating?.quality?.average ?? 0) > 0
            ? item.product_rating.quality.average
            : null;

    const reviewCount: number =
        Number(item?.product_rating?.quality?.number_of_ratings ?? 0);

    const availability: boolean = item?.stock?.in_stock ?? true;

    return {
      platform: this.platformName,
      name,
      price: effectivePrice,
      currency: 'NGN',
      rating,
      reviewCount,
      url,
      availability,
      imageUrl,
    };
  }
}
