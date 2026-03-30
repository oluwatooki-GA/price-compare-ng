/**
 * Search Service
 *
 * Coordinates keyword searches and URL-based product lookups across all platforms
 */

import { ProductData, SearchFilters } from '../../../scrapers/base';
import { ScraperRegistry } from '../../../scrapers/registry';
import { NormalizationService, ComparisonResult } from './normalization';
import { ValidationError, ScrapingError } from '../../../shared/errors';
import { createClient } from 'redis';
import { config } from '../../../config/env';

/**
 * URL validation result
 */
export interface UrlValidationResult {
    isValid: boolean;
    platform?: string;
}

/**
 * Search service for coordinating product searches across platforms
 */
export class SearchService {
    private scraperRegistry: ScraperRegistry;
    private normalizationService: NormalizationService;
    private redisClient: ReturnType<typeof createClient> | null = null;
    private readonly CACHE_TTL_SEC = 300; // 5 minutes

    constructor(
        scraperRegistry: ScraperRegistry,
        normalizationService: NormalizationService,
    ) {
        this.scraperRegistry = scraperRegistry;
        this.normalizationService = normalizationService;
    }

    /**
     * Initialize Redis connection for caching
     */
    async connect(): Promise<void> {
        if (!config.REDIS_URL) {
            console.log('Redis URL not configured, caching disabled');
            return;
        }

        try {
            this.redisClient = createClient({ url: config.REDIS_URL });
            this.redisClient.on('error', (err) => console.error('Redis cache error:', err));
            await this.redisClient.connect();
            console.log('Redis cache connected');
        } catch (error) {
            console.warn('Failed to connect to Redis for caching:', error);
            this.redisClient = null;
        }
    }

    /**
     * Close Redis connection
     */
    async disconnect(): Promise<void> {
        if (this.redisClient) {
            await this.redisClient.quit().catch(() => {});
            this.redisClient = null;
        }
    }

    /**
     * Search all platforms for products matching the keyword with optional filters
     * Requirement 2.1: Query all supported platforms for matching products
     *
     * @param keyword - Search term
     * @param filters - Optional search filters
     * @returns Array of comparison results with grouped similar products
     * @throws ValidationError if keyword is invalid
     */
    async searchByKeyword(
        keyword: string,
        filters: {
            minPrice?: number;
            maxPrice?: number;
            platforms?: string[];
            minRating?: number;
            availableOnly?: boolean;
            sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'name';
            limit?: number;
        } = {}
    ): Promise<ComparisonResult[]> {
        // Validate keyword
        if (!keyword || keyword.trim().length < 2) {
            throw new ValidationError('Search keyword must be at least 2 characters');
        }

        const normalizedKeyword = keyword.trim();

        // Check cache first
        const filterKey = JSON.stringify({
            minPrice: filters.minPrice,
            maxPrice: filters.maxPrice,
            platforms: filters.platforms?.slice().sort(),
            minRating: filters.minRating,
            availableOnly: filters.availableOnly,
        });
        const cacheKey = `search:keyword:${normalizedKeyword.toLowerCase()}:${filterKey}`;
        const cachedResult = await this.getCachedResult(cacheKey);
        if (cachedResult) {
            console.log(`Cache hit for keyword: "${normalizedKeyword}"`);
            return cachedResult;
        }

        // Get all registered scrapers (filter by platform if specified)
        let scrapers = this.scraperRegistry.getAllScrapers();

        if (filters.platforms && filters.platforms.length > 0) {
            scrapers = scrapers.filter(scraper => filters.platforms!.includes(scraper.platformName));
            console.log(`Filtered to ${scrapers.length} platforms: ${filters.platforms.join(', ')}`);
        }

        if (scrapers.length === 0) {
            throw new ScrapingError('No platform scrapers are registered or match the filter criteria');
        }

        // Search all platforms concurrently
        const searchPromises = scrapers.map(async (scraper) => {
            try {
                console.log(`Searching ${scraper.platformName} for "${normalizedKeyword}"`);
                const scraperFilters: SearchFilters = {
                    minPrice: filters.minPrice,
                    maxPrice: filters.maxPrice,
                    minRating: filters.minRating,
                };
                const results = await scraper.searchProducts(
                    normalizedKeyword,
                    filters.limit ?? 10,
                    scraperFilters
                );
                console.log(`${scraper.platformName} returned ${results.length} products`);
                return results;
            } catch (error) {
                console.error(
                    `Failed to search ${scraper.platformName} for "${normalizedKeyword}":`,
                    error instanceof Error ? error.message : String(error)
                );
                return [];
            }
        });

        const results = await Promise.all(searchPromises);

        // Flatten results from all platforms
        const allProducts = results.flat();
        console.log(`Total products from all platforms: ${allProducts.length}`);

        // Only availableOnly needs service-level filtering
        const filteredProducts = filters.availableOnly
            ? allProducts.filter(p => p.availability)
            : allProducts;

        if (filters.availableOnly) {
            console.log(`After availability filter: ${filteredProducts.length} products`);
        }

        // Log platform breakdown
        const platformCounts = filteredProducts.reduce((acc, product) => {
            acc[product.platform] = (acc[product.platform] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        console.log('Filtered products by platform:', platformCounts);

        if (filteredProducts.length === 0) {
            console.log('No products found after applying filters');
            return [];
        }

        // Group similar products
        let comparisonResults = this.normalizationService.groupSimilarProducts(filteredProducts, normalizedKeyword);
        console.log(`Created ${comparisonResults.length} comparison results`);

        // Apply sorting to comparison results
        if (filters.sortBy) {
            comparisonResults = this.sortComparisonResults(comparisonResults, filters.sortBy);
            console.log(`Sorted ${comparisonResults.length} results by ${filters.sortBy}`);
        }

        // Apply limit
        if (filters.limit && filters.limit < comparisonResults.length) {
            comparisonResults = comparisonResults.slice(0, filters.limit);
            console.log(`Limited results to ${filters.limit} comparisons`);
        }

        // Set search query for each result
        comparisonResults.forEach(result => {
            result.searchQuery = normalizedKeyword;
        });

        // Cache the results
        await this.cacheResult(cacheKey, comparisonResults);

        return comparisonResults;
    }

    /**
     * Extract product from URL and find similar products on other platforms
     *
     * @param url - Product URL from a supported platform
     * @returns Comparison result with the original product and similar products from other platforms
     * @throws ValidationError if URL is invalid
     */
    async searchByUrl(url: string): Promise<ComparisonResult> {
        // Validate URL
        const validation = this.validateUrl(url);
        if (!validation.isValid || !validation.platform) {
            throw new ValidationError(
                'Invalid URL. Please provide a valid product URL from a supported platform (Jumia or Konga).'
            );
        }

        // Check cache first
        const cacheKey = `search:url:${url}`;
        const cachedResult = await this.getCachedResult(cacheKey);
        if (cachedResult && cachedResult.length > 0) {
            console.log(`Cache hit for URL: ${url}`);
            return cachedResult[0];
        }

        // Get the scraper for this platform
        const scraper = this.scraperRegistry.getScraperByPlatform(validation.platform);
        if (!scraper) {
            throw new ValidationError(`No scraper found for platform: ${validation.platform}`);
        }

        // Extract product data from the URL
        let mainProduct: ProductData;
        try {
            mainProduct = await scraper.getProductByUrl(url);
        } catch (error) {
            throw new ScrapingError(
                `Failed to extract product data from URL: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        console.log(`URL Search: Extracted main product from ${validation.platform}:`, mainProduct.name);

        // Search other platforms for similar products
        const otherScrapers = this.scraperRegistry
            .getAllScrapers()
            .filter(s => s.platformName !== validation.platform);

        console.log(`URL Search: Searching ${otherScrapers.length} other platforms for similar products`);

        const searchPromises = otherScrapers.map(async (otherScraper) => {
            try {
                console.log(`URL Search: Searching ${otherScraper.platformName} for "${mainProduct.name}"`);
                const results = await otherScraper.searchProducts(mainProduct.name, 5);
                console.log(`URL Search: ${otherScraper.platformName} returned ${results.length} similar products`);
                return results;
            } catch (error) {
                console.error(
                    `Failed to search ${otherScraper.platformName} for similar products:`,
                    error instanceof Error ? error.message : String(error)
                );
                return [];
            }
        });

        const results = await Promise.all(searchPromises);
        const similarProducts = results.flat();

        console.log(`URL Search: Found ${similarProducts.length} similar products from other platforms`);

        // Combine main product with similar products
        const allProducts = [mainProduct, ...similarProducts];

        console.log(`URL Search: Total products for comparison: ${allProducts.length}`);

        // Group similar products
        const comparisonResults = this.normalizationService.groupSimilarProducts(allProducts, mainProduct.name);

        // Find the group containing the main product
        let mainComparison = comparisonResults.find(result =>
            result.products.some(p => p.url === mainProduct.url)
        );

        // If no group found, create one with just the main product
        if (!mainComparison) {
            const bestValueIndex = 0;
            mainComparison = {
                products: [mainProduct],
                bestValueIndex,
                searchQuery: url,
                timestamp: new Date()
            };
        } else {
            mainComparison.searchQuery = url;
        }

        // Cache the result
        await this.cacheResult(cacheKey, [mainComparison]);

        return mainComparison;
    }

    /**
     * Validate that a URL belongs to a supported platform
     *
     * @param url - URL to validate
     * @returns Validation result with platform name if valid
     */
    validateUrl(url: string): UrlValidationResult {
        // Basic URL format validation
        try {
            new URL(url);
        } catch {
            return { isValid: false };
        }

        // Check if URL belongs to any registered platform
        const scrapers = this.scraperRegistry.getAllScrapers();

        for (const scraper of scrapers) {
            if (scraper.isValidUrl(url)) {
                return {
                    isValid: true,
                    platform: scraper.platformName
                };
            }
        }

        return { isValid: false };
    }

    /**
     * Get cached search results from Redis
     *
     * @param cacheKey - Cache key
     * @returns Cached comparison results or null if not found
     */
    private async getCachedResult(cacheKey: string): Promise<ComparisonResult[] | null> {
        if (!this.redisClient) {
            return null;
        }

        try {
            const cached = await this.redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached) as ComparisonResult[];
            }
        } catch (error) {
            console.error('Cache get error:', error);
        }
        return null;
    }

    /**
     * Cache search results in Redis with TTL
     *
     * @param cacheKey - Cache key
     * @param results - Comparison results to cache
     */
    private async cacheResult(cacheKey: string, results: ComparisonResult[]): Promise<void> {
        if (!this.redisClient) {
            return;
        }

        try {
            await this.redisClient.setEx(cacheKey, this.CACHE_TTL_SEC, JSON.stringify(results));
            console.log(`Cached results for key: ${cacheKey}`);
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    /**
     * Sort comparison results based on the specified criteria
     *
     * @param results - Array of comparison results to sort
     * @param sortBy - Sorting criteria
     * @returns Sorted comparison results
     */
    private sortComparisonResults(
        results: ComparisonResult[],
        sortBy: 'price_asc' | 'price_desc' | 'rating' | 'name'
    ): ComparisonResult[] {
        return results.sort((a, b) => {
            const aBest = a.products[a.bestValueIndex];
            const bBest = b.products[b.bestValueIndex];

            switch (sortBy) {
                case 'price_asc':
                    return aBest.price - bBest.price;
                case 'price_desc':
                    return bBest.price - aBest.price;
                case 'rating':
                    return (bBest.rating || 0) - (aBest.rating || 0);
                case 'name':
                    return aBest.name.localeCompare(bBest.name);
                default:
                    return 0;
            }
        });
    }

}
