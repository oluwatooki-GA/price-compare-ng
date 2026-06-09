import { ProductData, SearchFilters } from '../scrapers/base';
import { ScraperRegistry } from '../scrapers/registry';
import { NormalizationService, ComparisonResult } from '../api/v1/search/normalization';
import { ValidationError, ScrapingError } from '../shared/errors';
import { createClient } from 'redis';
import { config } from '../config/env';

export interface UrlValidationResult {
    isValid: boolean;
    platform?: string;
}

export class ScraperService {
    private scraperRegistry: ScraperRegistry;
    private normalizationService: NormalizationService;
    private redisClient: ReturnType<typeof createClient> | null = null;
    private readonly CACHE_TTL_SEC = 300;
    private readonly SCRAPER_TIMEOUT_MS = 15_000;
    private _ownClient = false;

    constructor(
        scraperRegistry: ScraperRegistry,
        normalizationService: NormalizationService,
        redisClient?: ReturnType<typeof createClient> | null,
    ) {
        this.scraperRegistry = scraperRegistry;
        this.normalizationService = normalizationService;
        if (redisClient) {
            this.redisClient = redisClient;
        }
    }

    async connect(): Promise<void> {
        if (this.redisClient) return;
        if (!config.REDIS_URL) {
            console.log('Redis URL not configured, caching disabled');
            return;
        }
        try {
            this.redisClient = createClient({ url: config.REDIS_URL });
            this.redisClient.on('error', (err) => console.error('Redis cache error:', err));
            if (!this.redisClient.isOpen) {
                await this.redisClient.connect();
            }
            this._ownClient = true;
            console.log('Redis cache connected');
        } catch (error) {
            console.warn('Failed to connect to Redis for caching:', error);
            this.redisClient = null;
        }
    }

    async disconnect(): Promise<void> {
        if (this.redisClient && this._ownClient) {
            await this.redisClient.quit().catch(() => {});
            this.redisClient = null;
        }
    }

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
        if (!keyword || keyword.trim().length < 2) {
            throw new ValidationError('Search keyword must be at least 2 characters');
        }

        const normalizedKeyword = keyword.trim();

        const filterKey = JSON.stringify({
            minPrice: filters.minPrice,
            maxPrice: filters.maxPrice,
            platforms: filters.platforms?.slice().sort(),
            minRating: filters.minRating,
            availableOnly: filters.availableOnly,
            limit: filters.limit,
        });
        const cacheKey = `search:keyword:${normalizedKeyword.toLowerCase()}:${filterKey}`;
        const cachedResult = await this.getCachedResult(cacheKey);
        if (cachedResult) {
            console.log(`Cache hit for keyword: "${normalizedKeyword}"`);
            return cachedResult;
        }

        let scrapers = this.scraperRegistry.getAllScrapers();
        if (filters.platforms && filters.platforms.length > 0) {
            scrapers = scrapers.filter(s => filters.platforms!.includes(s.platformName));
        }
        if (scrapers.length === 0) {
            throw new ScrapingError('No platform scrapers are registered or match the filter criteria');
        }

        const searchPromises = scrapers.map(async (scraper) => {
            try {
                const scraperFilters: SearchFilters = {
                    minPrice: filters.minPrice,
                    maxPrice: filters.maxPrice,
                    minRating: filters.minRating,
                };
                const results = await this.withTimeout(
                    scraper.searchProducts(normalizedKeyword, filters.limit ?? 10, scraperFilters),
                    scraper.platformName,
                );
                console.log(`${scraper.platformName} returned ${results.length} products`);
                return results;
            } catch (error) {
                console.error(`Failed to search ${scraper.platformName}:`, error instanceof Error ? error.message : String(error));
                return [];
            }
        });

        const results = await Promise.all(searchPromises);
        const allProducts = results.flat();

        const filteredProducts = filters.availableOnly
            ? allProducts.filter(p => p.availability)
            : allProducts;

        if (filteredProducts.length === 0) return [];

        let comparisonResults = this.normalizationService.groupSimilarProducts(filteredProducts, normalizedKeyword);

        if (filters.sortBy) {
            comparisonResults = this.sortComparisonResults(comparisonResults, filters.sortBy);
        }
        if (filters.limit && filters.limit < comparisonResults.length) {
            comparisonResults = comparisonResults.slice(0, filters.limit);
        }

        comparisonResults.forEach(r => { r.searchQuery = normalizedKeyword; });
        await this.cacheResult(cacheKey, comparisonResults);
        return comparisonResults;
    }

    async searchByUrl(url: string): Promise<ComparisonResult> {
        const validation = this.validateUrl(url);
        if (!validation.isValid || !validation.platform) {
            throw new ValidationError('Invalid URL. Please provide a valid product URL from a supported platform (Jumia, Konga, or Jiji).');
        }

        const cacheKey = `search:url:${url}`;
        const cachedResult = await this.getCachedResult(cacheKey);
        if (cachedResult && cachedResult.length > 0) return cachedResult[0];

        const scraper = this.scraperRegistry.getScraperByPlatform(validation.platform);
        if (!scraper) throw new ValidationError(`No scraper found for platform: ${validation.platform}`);

        let mainProduct: ProductData;
        try {
            mainProduct = await scraper.getProductByUrl(url);
        } catch (error) {
            throw new ScrapingError(`Failed to extract product data from URL: ${error instanceof Error ? error.message : String(error)}`);
        }

        const otherScrapers = this.scraperRegistry.getAllScrapers().filter(s => s.platformName !== validation.platform);
        const searchPromises = otherScrapers.map(async (otherScraper) => {
            try {
                return await this.withTimeout(otherScraper.searchProducts(mainProduct.name, 5), otherScraper.platformName);
            } catch {
                return [];
            }
        });

        const similarProducts = (await Promise.all(searchPromises)).flat();
        const allProducts = [mainProduct, ...similarProducts];
        const comparisonResults = this.normalizationService.groupSimilarProducts(allProducts, mainProduct.name);

        let mainComparison = comparisonResults.find(r => r.products.some(p => p.url === mainProduct.url));
        if (!mainComparison) {
            mainComparison = { products: [mainProduct], bestValueIndex: 0, searchQuery: url, timestamp: new Date() };
        } else {
            mainComparison.searchQuery = url;
        }

        await this.cacheResult(cacheKey, [mainComparison]);
        return mainComparison;
    }

    validateUrl(url: string): UrlValidationResult {
        try { new URL(url); } catch { return { isValid: false }; }
        for (const scraper of this.scraperRegistry.getAllScrapers()) {
            if (scraper.isValidUrl(url)) return { isValid: true, platform: scraper.platformName };
        }
        return { isValid: false };
    }

    private withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`${label} timed out after ${this.SCRAPER_TIMEOUT_MS}ms`)), this.SCRAPER_TIMEOUT_MS)
            ),
        ]);
    }

    private async getCachedResult(cacheKey: string): Promise<ComparisonResult[] | null> {
        if (!this.redisClient) return null;
        try {
            const cached = await this.redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached) as ComparisonResult[];
        } catch (error) {
            console.error('Cache get error:', error);
        }
        return null;
    }

    private async cacheResult(cacheKey: string, results: ComparisonResult[]): Promise<void> {
        if (!this.redisClient) return;
        try {
            await this.redisClient.setEx(cacheKey, this.CACHE_TTL_SEC, JSON.stringify(results));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    private sortComparisonResults(results: ComparisonResult[], sortBy: 'price_asc' | 'price_desc' | 'rating' | 'name'): ComparisonResult[] {
        return results.sort((a, b) => {
            const aBest = a.products[a.bestValueIndex];
            const bBest = b.products[b.bestValueIndex];
            switch (sortBy) {
                case 'price_asc':  return aBest.price - bBest.price;
                case 'price_desc': return bBest.price - aBest.price;
                case 'rating':     return (bBest.rating || 0) - (aBest.rating || 0);
                case 'name':       return aBest.name.localeCompare(bBest.name);
                default:           return 0;
            }
        });
    }
}

// Backward-compat alias so existing tests and imports referencing SearchService still compile
export { ScraperService as SearchService };
