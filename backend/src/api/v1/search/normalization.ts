/**
 * Normalization Service
 *
 * Handles product similarity calculation, grouping, and best value identification.
 */

import { ProductData } from '../../../scrapers/base';

export interface ComparisonResult {
  products: ProductData[];
  bestValueIndex: number;
  searchQuery: string;
  timestamp: Date;
}

export class NormalizationService {
  // Minimum Jaccard similarity for two products to be grouped together.
  // 0.55 is tight enough to avoid cross-category false positives (e.g. a power
  // bank matching a laptop) while still grouping genuine variants of the same
  // product across platforms.
  // TODO: Re-enable when product grouping is implemented
  // private readonly SIMILARITY_THRESHOLD = 0.55;

  // A product is an outlier if its price deviates more than this many standard
  // deviations from the median of all scraped products. Outliers are dropped
  // before grouping.
  private readonly OUTLIER_STDEV_THRESHOLD = 2.0;

  // Products whose names contain any of these tokens are accessories for the
  // searched item, not the item itself. They are dropped before grouping so
  // a search for "iPhone 15" never surfaces cases, cables, or screen protectors.
  private readonly ACCESSORY_TERMS = new Set([
    'case', 'cases', 'cover', 'covers', 'casing',
    'protector', 'tempered', 'glass', 'film', 'screen',
    'charger', 'charging', 'cable', 'cables', 'adapter', 'adaptor',
    'holder', 'stand', 'mount', 'pouch', 'bag', 'sleeve',
    'strap', 'band', 'bumper', 'skin', 'sticker',
    'earphone', 'earphones', 'headphone', 'headphones', 'earbud', 'earbuds',
    'airpod', 'airpods',
  ]);

  /**
   * Calculate Jaccard similarity between two product names.
   * The search query tokens are stripped from both names before comparison so
   * that the shared search keyword doesn't artificially inflate similarity
   * (e.g. "laptop power bank" vs "laptop i7" both containing "laptop").
   */
  calculateSimilarity(name1: string, name2: string, searchQuery = ''): number {
    const queryTokens = new Set(this.tokenize(searchQuery));

    const tokens1 = this.tokenize(name1).filter(t => !queryTokens.has(t));
    const tokens2 = this.tokenize(name2).filter(t => !queryTokens.has(t));

    // If stripping the query leaves nothing, fall back to the raw tokens so
    // single-word searches still produce a score.
    const t1 = tokens1.length > 0 ? tokens1 : this.tokenize(name1);
    const t2 = tokens2.length > 0 ? tokens2 : this.tokenize(name2);

    const intersection = t1.filter(t => t2.includes(t));
    const union = [...new Set([...t1, ...t2])];

    if (union.length === 0) return 0;
    return intersection.length / union.length;
  }

  /**
   * Group similar products and remove price outliers within each group.
   *
   * @param products    - Flat list of products from all platforms
   * @param _searchQuery - The original search keyword (unused for now, will be used when grouping is re-enabled)
   */
  groupSimilarProducts(products: ProductData[], _searchQuery = ''): ComparisonResult[] {
    console.log(`\n[NormalizationService] ── filtering ${products.length} products ──`);

    // Step 1: drop accessories (cases, cables, chargers, screen protectors, etc.)
    const accessories: ProductData[] = [];
    const withoutAccessories = products.filter(p => {
      if (this.isAccessory(p.name)) {
        accessories.push(p);
        return false;
      }
      return true;
    });

    if (accessories.length > 0) {
      console.log(`[NormalizationService] Dropped ${accessories.length} accessor(ies):`);
      accessories.forEach(p =>
          console.log(`  ✗ [accessory]  "${p.name}" @ ₦${p.price} (${p.platform})`)
      );
    } else {
      console.log(`[NormalizationService] No accessories dropped`);
    }

    // Step 2: drop price outliers from the flat list.
    // A product priced below 10% or above 10x the median, or beyond 2σ, is
    // almost certainly a wrong-category result and is removed entirely.
    const { core, outliers } = this.removeOutliers(withoutAccessories);

    if (outliers.length > 0) {
      console.log(`[NormalizationService] Dropped ${outliers.length} price outlier(s):`);
      outliers.forEach(p =>
          console.log(`  ✗ [outlier]    "${p.name}" @ ₦${p.price} (${p.platform})`)
      );
    } else {
      console.log(`[NormalizationService] No price outliers dropped`);
    }

    console.log(`[NormalizationService] ${products.length} in → ${accessories.length} accessories + ${outliers.length} outliers removed → ${core.length} remaining`);

    // Step 3: return each surviving product as its own ComparisonResult.
    // Similarity-based grouping is intentionally not applied here — each
    // product stands alone so the caller receives a flat, clean list.

    return core.map(product => ({
      products: [product],
      bestValueIndex: 0,
      searchQuery: '',   // set by SearchService
      timestamp: new Date(),
    }));
  }

  /**
   * Identify the best value product in a group.
   * Priority: lowest price → highest rating → most reviews.
   */
  identifyBestValue(products: ProductData[]): ProductData {
    if (products.length === 0) {
      throw new Error('Cannot identify best value from empty product list');
    }
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

  /**
   * Split a group into core (non-outlier) products and outliers.
   *
   * A product is an outlier if its price is more than OUTLIER_STDEV_THRESHOLD
   * standard deviations from the group median. Groups of 1–2 products are
   * never split (not enough data for a meaningful stdev).
   */
  private removeOutliers(products: ProductData[]): {
    core: ProductData[];
    outliers: ProductData[];
  } {
    if (products.length < 2) return { core: products, outliers: [] };

    const prices = products.map(p => p.price);
    const median = this.median(prices);
    const stdev = this.stdev(prices);

    // With only 2-3 products stdev can be skewed by the outlier itself, so we
    // use a minimum floor: any product priced less than 10% of the median or
    // more than 10x the median is always an outlier regardless of stdev.
    const FLOOR_RATIO = 0.10;   // below 10% of median → outlier
    const CEILING_RATIO = 10.0; // above 10x median   → outlier

    const core: ProductData[] = [];
    const outliers: ProductData[] = [];

    for (const product of products) {
      const ratio = product.price / median;
      const zScore = stdev > 0 ? Math.abs(product.price - median) / stdev : 0;

      const isOutlier =
          ratio < FLOOR_RATIO ||
          ratio > CEILING_RATIO ||
          (stdev > 0 && zScore > this.OUTLIER_STDEV_THRESHOLD);

      if (isOutlier) {
        console.log(
            `  Outlier removed: "${product.name}" @ ₦${product.price} ` +
            `(ratio=${ratio.toFixed(2)}x median ₦${median.toFixed(0)}, z=${zScore.toFixed(2)})`
        );
        outliers.push(product);
      } else {
        core.push(product);
      }
    }

    // Safety: if everything was flagged, keep them all
    if (core.length === 0) return { core: products, outliers: [] };

    return { core, outliers };
  }

  /**
   * Returns true if the product name looks like an accessory for the searched
   * item rather than the item itself.
   */
  private isAccessory(name: string): boolean {
    const tokens = new Set(
        name.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 0)
    );
    for (const term of this.ACCESSORY_TERMS) {
      if (tokens.has(term)) return true;
    }
    return false;
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

  /**
   * Tokenize a product name into normalised, deduplicated tokens.
   * Removes stop words and normalises common product term variants.
   */
  private tokenize(name: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'must', 'can', 'plus', 'extra',
      'free', 'new', 'original', 'official', 'genuine', 'brand',
    ]);

    const tokens = name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(t => t.length > 0 && !stopWords.has(t))
        .map(t => {
          // Normalise storage unit variants so "256gb" and "256gigabytes" match
          if (/^(gb|gigabyte|gigabytes)$/.test(t)) return 'gb';
          if (/^(tb|terabyte|terabytes)$/.test(t)) return 'tb';
          return t;
        });

    return [...new Set(tokens)];
  }
}
