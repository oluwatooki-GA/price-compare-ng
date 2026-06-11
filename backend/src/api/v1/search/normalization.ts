import { ProductData } from '../../../scrapers/base';
import { logger } from '../../../config/logger';

export interface ComparisonResult {
  products: ProductData[];
  bestValueIndex: number;
  searchQuery: string;
  timestamp: Date;
}

export class NormalizationService {
  // A product is an outlier if its price deviates more than this many standard
  // deviations from the median of all scraped products.
  private readonly OUTLIER_STDEV_THRESHOLD = 2.0;

  /**
   * Remove price outliers from a flat product list, then return each surviving
   * product as its own ComparisonResult.
   */
  groupSimilarProducts(products: ProductData[]): ComparisonResult[] {
    const { core, outliers } = this.removeOutliers(products);

    if (outliers.length > 0) {
      logger.debug(
        { count: outliers.length, outliers: outliers.map(p => ({ name: p.name, price: p.price, platform: p.platform })) },
        'Price outliers removed',
      );
    }

    logger.debug({ total: products.length, removed: outliers.length, remaining: core.length }, 'Normalization complete');

    return core.map(product => ({
      products: [product],
      bestValueIndex: 0,
      searchQuery: '',
      timestamp: new Date(),
    }));
  }

  /**
   * Identify the best value product in a group.
   * Priority: lowest price → highest rating → most reviews.
   */
  identifyBestValue(products: ProductData[]): ProductData {
    if (products.length === 0) throw new Error('Cannot identify best value from empty product list');
    if (products.length === 1) return products[0];

    const available = products.filter(p => p.availability);
    const pool = available.length > 0 ? available : products;

    const lowestPrice = Math.min(...pool.map(p => p.price));
    const priceThreshold = lowestPrice * 1.05;
    const nearestPrice = pool.filter(p => p.price <= priceThreshold);

    return nearestPrice.reduce((best, current) => {
      const bRating = best.rating ?? 0;
      const cRating = current.rating ?? 0;
      if (cRating !== bRating) return cRating > bRating ? current : best;
      return current.reviewCount > best.reviewCount ? current : best;
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private removeOutliers(products: ProductData[]): { core: ProductData[]; outliers: ProductData[] } {
    if (products.length < 2) return { core: products, outliers: [] };

    const prices = products.map(p => p.price);
    const median = this.median(prices);
    const stdev = this.stdev(prices);

    const FLOOR_RATIO = 0.10;
    const CEILING_RATIO = 10.0;

    const core: ProductData[] = [];
    const outliers: ProductData[] = [];

    for (const product of products) {
      const ratio = product.price / median;
      const zScore = stdev > 0 ? Math.abs(product.price - median) / stdev : 0;

      const isOutlier =
        ratio < FLOOR_RATIO ||
        ratio > CEILING_RATIO ||
        (stdev > 0 && zScore > this.OUTLIER_STDEV_THRESHOLD);

      (isOutlier ? outliers : core).push(product);
    }

    // Safety: if everything was flagged, keep them all
    if (core.length === 0) return { core: products, outliers: [] };

    return { core, outliers };
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private stdev(values: number[]): number {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  private tokenize(name: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'must', 'can', 'plus', 'extra',
      'free', 'new', 'original', 'official', 'genuine', 'brand', 'old',
    ]);

    const tokens = name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length > 0 && !stopWords.has(t))
      .map(t => {
        if (/^(gb|gigabyte|gigabytes)$/.test(t)) return 'gb';
        if (/^(tb|terabyte|terabytes)$/.test(t)) return 'tb';
        return t;
      });

    return [...new Set(tokens)];
  }
}
