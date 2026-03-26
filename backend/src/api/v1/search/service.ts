/**
 * Search Service
 *
 * Coordinates keyword searches and URL-based product lookups across all platforms
 */

import { ProductData, SearchFilters } from '../../../scrapers/base';
import { ScraperRegistry } from '../../../scrapers/registry';
import { NormalizationService, ComparisonResult } from './normalization';
import { ValidationError, ScrapingError } from '../../../shared/errors';
// import { PriceHistoryService } from '../comparisons/priceHistory'; // TODO: Re-enable when price history is implemented

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
    // private priceHistoryService: PriceHistoryService; // TODO: Re-enable when price history is implemented
    private cache: Map<string, { data: any; timestamp: number }> = new Map();
    private readonly CACHE_TTL_MS = 300000; // 5 minutes

    constructor(
        scraperRegistry: ScraperRegistry,
        normalizationService: NormalizationService,
        // priceHistoryService: PriceHistoryService // TODO: Re-enable when price history is implemented
    ) {
        this.scraperRegistry = scraperRegistry;
        this.normalizationService = normalizationService;
        // this.priceHistoryService = priceHistoryService; // TODO: Re-enable when price history is implemented
    }

    /**
     * Initialize the service (no-op for in-memory cache)
     */
    async connect(): Promise<void> {
        // No-op
    }

    /**
     * Close the service (no-op for in-memory cache)
     */
    async disconnect(): Promise<void> {
        this.cache.clear();
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
        // Price and rating filters are passed into each scraper so they are applied
        // at the API/query level. availableOnly has no server-side equivalent on any
        // platform so it is applied here after results come back.
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
                // Requirement 2.5: Continue processing other platforms if one fails
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
        console.log('PRODUCTS: ',allProducts)
        // Only availableOnly needs service-level filtering — everything else was
        // handled at the scraper level.
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

        // Record prices for all products (Requirement 6.1)
        // TODO: Re-enable when price history feature is implemented
        // await this.recordPricesForProducts(filteredProducts);

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
     * Requirements 3.2, 3.3: Extract product data and search other platforms
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
                // Use the product name as search keyword
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

        // Record prices for all products (Requirement 6.1)
        // TODO: Re-enable when price history feature is implemented
        // await this.recordPricesForProducts(allProducts);

        // Group similar products (should group the main product with its matches)
        const comparisonResults = this.normalizationService.groupSimilarProducts(allProducts, mainProduct.name);

        // Find the group containing the main product
        let mainComparison = comparisonResults.find(result =>
            result.products.some(p => p.url === mainProduct.url)
        );

        // If no group found (shouldn't happen), create one with just the main product
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
     * Requirements 3.1, 3.5: URL validation for supported platforms
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
     * Get cached search results
     *
     * @param cacheKey - Cache key
     * @returns Cached comparison results or null if not found
     */
    private async getCachedResult(cacheKey: string): Promise<ComparisonResult[] | null> {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
            return cached.data;
        }
        // Remove expired cache
        if (cached) {
            this.cache.delete(cacheKey);
        }
        return null;
    }

    /**
     * Cache search results with TTL
     *
     * @param cacheKey - Cache key
     * @param results - Comparison results to cache
     */
    private async cacheResult(cacheKey: string, results: ComparisonResult[]): Promise<void> {
        this.cache.set(cacheKey, {
            data: results,
            timestamp: Date.now()
        });
    }


    /**
     * Record prices for all products in the price history
     * Requirement 6.1: Price history is recorded on retrieval
     * TODO: Re-enable when price history feature is implemented
     *
     * @param products - Array of product data to record
     */
    // private async recordPricesForProducts(products: ProductData[]): Promise<void> {
    //     // Disabled for now - will be re-enabled when price history feature is implemented
    //     return;
        
    //     // Record prices concurrently, but don't fail the search if recording fails
    //     const recordPromises = products.map(async (product) => {
    //         try {
    //             await this.priceHistoryService.recordPrice(
    //                 product.url,
    //                 product.platform,
    //                 product.price,
    //                 product.currency
    //             );
    //         } catch (error) {
    //             console.error(
    //                 `Failed to record price for ${product.platform} product:`,
    //                 error instanceof Error ? error.message : String(error)
    //             );
    //         }
    //     });

    //     await Promise.all(recordPromises);
    // }

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
