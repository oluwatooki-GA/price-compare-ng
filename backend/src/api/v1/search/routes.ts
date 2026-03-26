import { Router, Request, Response, NextFunction } from 'express';
import { SearchService } from './service';
import { KeywordSearchRequestSchema, UrlSearchRequestSchema } from './schemas';
import { ValidationError } from '../../../shared/errors';
import { unauthenticatedLimiter, authenticatedLimiter } from '../../../middleware/rateLimiter';
import { ScraperRegistry } from '../../../scrapers/registry';
import { JumiaScraper } from '../../../scrapers/jumia';
import { JijiScraper } from '../../../scrapers/jiji';
// import { TemuScraper } from '../../../scrapers/temu'; // TODO: Re-enable when Temu scraper is working
import { KongaScraper } from '../../../scrapers/konga';
import { NormalizationService } from './normalization';
import { verifyToken } from '../../../config/security';
// import { PriceHistoryService } from '../comparisons/priceHistory'; // TODO: Re-enable when price history is implemented
// import { prisma } from '../../../config/database'; // TODO: Re-enable when price history is implemented

const router = Router();

// Initialize services
const scraperRegistry = new ScraperRegistry();

// Register platform scrapers
scraperRegistry.registerScraper(new JumiaScraper());
scraperRegistry.registerScraper(new JijiScraper());
// scraperRegistry.registerScraper(new TemuScraper()); TEMY NOT WORKING YET
scraperRegistry.registerScraper(new KongaScraper());

const normalizationService = new NormalizationService();
// const priceHistoryService = new PriceHistoryService(prisma); // TODO: Re-enable when price history is implemented
const searchService = new SearchService(scraperRegistry, normalizationService);

// Connect to Redis on startup
searchService.connect().catch((err) => {
  console.error('Failed to connect SearchService to Redis:', err);
});

/**
 * Extended Request interface with optional user property
 */
interface OptionalAuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

/**
 * Optional authentication middleware.
 * Attaches the decoded JWT payload to req.user if a valid Bearer token is present.
 * Does not reject the request if the token is missing or invalid.
 */
function optionalAuth(
  req: OptionalAuthRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const payload = verifyToken(parts[1]);
        if (payload) {
          req.user = { userId: payload.userId, email: payload.email };
        }
      }
    }
    next();
  } catch {
    next();
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductData:
 *       type: object
 *       properties:
 *         platform:
 *           type: string
 *           example: jumia
 *         name:
 *           type: string
 *           example: Samsung Galaxy S24 128GB
 *         price:
 *           type: number
 *           example: 450000
 *         currency:
 *           type: string
 *           example: NGN
 *         rating:
 *           type: number
 *           nullable: true
 *           example: 4.5
 *         reviewCount:
 *           type: integer
 *           example: 128
 *         url:
 *           type: string
 *           example: https://www.jumia.com.ng/samsung-galaxy-s24.html
 *         availability:
 *           type: boolean
 *           example: true
 *         imageUrl:
 *           type: string
 *           nullable: true
 *           example: https://img.jumia.com.ng/cms/images/samsung.jpg
 *
 *     ComparisonResult:
 *       type: object
 *       properties:
 *         products:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductData'
 *         bestValueIndex:
 *           type: integer
 *           description: Index of the best-value product in the products array
 *           example: 0
 *         searchQuery:
 *           type: string
 *           example: samsung galaxy s24
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     KeywordSearchRequest:
 *       type: object
 *       required:
 *         - keyword
 *       properties:
 *         keyword:
 *           type: string
 *           minLength: 2
 *           description: Product search term
 *           example: samsung galaxy s24
 *         minPrice:
 *           type: number
 *           minimum: 0
 *           description: Minimum price in NGN (inclusive)
 *           example: 100000
 *         maxPrice:
 *           type: number
 *           minimum: 0
 *           description: Maximum price in NGN (inclusive)
 *           example: 600000
 *         minRating:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *           description: Minimum product rating (0–5)
 *           example: 4
 *         platforms:
 *           type: array
 *           items:
 *             type: string
 *             enum: [jumia, jiji, temu, konga]
 *           description: Restrict search to specific platforms. Omit to search all.
 *           example: [jumia, konga]
 *         availableOnly:
 *           type: boolean
 *           description: When true, only return in-stock products
 *           example: true
 *         sortBy:
 *           type: string
 *           enum: [price_asc, price_desc, rating, name]
 *           description: Sort order for results
 *           example: price_asc
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           description: Maximum number of comparison groups to return
 *           example: 10
 *
 *     UrlSearchRequest:
 *       type: object
 *       required:
 *         - url
 *       properties:
 *         url:
 *           type: string
 *           format: uri
 *           description: Product page URL from a supported platform
 *           example: https://www.jumia.com.ng/samsung-galaxy-s24-128gb.html
 *         minPrice:
 *           type: number
 *           minimum: 0
 *           description: Minimum price filter for similar products (NGN)
 *           example: 100000
 *         maxPrice:
 *           type: number
 *           minimum: 0
 *           description: Maximum price filter for similar products (NGN)
 *           example: 600000
 *         minRating:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *           description: Minimum rating filter for similar products
 *           example: 4
 *         availableOnly:
 *           type: boolean
 *           description: Only return in-stock similar products
 *           example: true
 *
 *     SearchResponse:
 *       type: object
 *       properties:
 *         results:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ComparisonResult'
 *         count:
 *           type: integer
 *           description: Number of comparison groups returned
 *           example: 5
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: Validation failed
 *         message:
 *           type: string
 *           example: keyword must be at least 2 characters
 */

/**
 * @swagger
 * /search/keyword:
 *   post:
 *     summary: Search products by keyword across all platforms
 *     description: >
 *       Searches Jumia, Jiji, Temu, and Konga concurrently for products matching
 *       the keyword, groups similar results, and returns comparison groups with a
 *       best-value recommendation. Supports optional price range, rating, platform,
 *       availability, sort, and limit filters.
 *
 *       **Rate limiting:**
 *       - Unauthenticated: 10 requests / minute per IP
 *       - Authenticated (Bearer token): 60 requests / minute per user
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/KeywordSearchRequest'
 *           examples:
 *             basic:
 *               summary: Simple keyword search
 *               value:
 *                 keyword: samsung galaxy s24
 *             filtered:
 *               summary: Search with price range and rating filter
 *               value:
 *                 keyword: laptop
 *                 minPrice: 200000
 *                 maxPrice: 800000
 *                 minRating: 4
 *                 platforms: [jumia, konga]
 *                 availableOnly: true
 *                 sortBy: price_asc
 *                 limit: 10
 *     responses:
 *       200:
 *         description: Comparison groups of similar products across platforms
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResponse'
 *       400:
 *         description: Validation error — invalid or missing request fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/keyword',
  optionalAuth,
  (req: OptionalAuthRequest, res: Response, next: NextFunction) => {
    if (req.user) {
      authenticatedLimiter(req, res, next);
    } else {
      unauthenticatedLimiter(req, res, next);
    }
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationResult = KeywordSearchRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw new ValidationError(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
      }

      const { keyword, minPrice, maxPrice, platforms, minRating, availableOnly, sortBy, limit } =
        validationResult.data;

      const results = await searchService.searchByKeyword(keyword, {
        minPrice,
        maxPrice,
        platforms,
        minRating,
        availableOnly,
        sortBy,
        limit,
      });

      res.status(200).json({ results, count: results.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /search/url:
 *   post:
 *     summary: Look up a product by URL and find similar products on other platforms
 *     description: >
 *       Accepts a product page URL from any supported platform (Jumia, Jiji, Temu,
 *       Konga), extracts the product details, and searches the remaining platforms
 *       for similar products. Returns a single comparison group containing the
 *       source product and any matches found.
 *
 *       **Supported URL formats:**
 *       - Jumia: `https://www.jumia.com.ng/...`
 *       - Jiji: `https://jiji.ng/...`
 *       - Temu: `https://www.temu.com/...`
 *       - Konga: `https://www.konga.com/product/...`
 *
 *       **Rate limiting:**
 *       - Unauthenticated: 10 requests / minute per IP
 *       - Authenticated (Bearer token): 60 requests / minute per user
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UrlSearchRequest'
 *           examples:
 *             jumia:
 *               summary: Jumia product URL
 *               value:
 *                 url: https://www.jumia.com.ng/samsung-galaxy-s24-128gb.html
 *             filtered:
 *               summary: URL search with price and availability filters
 *               value:
 *                 url: https://www.konga.com/product/apple-iphone-15-128gb-6398820
 *                 minPrice: 300000
 *                 maxPrice: 900000
 *                 minRating: 3.5
 *                 availableOnly: true
 *     responses:
 *       200:
 *         description: Comparison result for the source product and similar items
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResponse'
 *       400:
 *         description: >
 *           Validation error — invalid URL format or URL does not belong to a
 *           supported platform
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/url',
  optionalAuth,
  (req: OptionalAuthRequest, res: Response, next: NextFunction) => {
    if (req.user) {
      authenticatedLimiter(req, res, next);
    } else {
      unauthenticatedLimiter(req, res, next);
    }
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationResult = UrlSearchRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw new ValidationError(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
      }

      const { url } = validationResult.data;
      const result = await searchService.searchByUrl(url);

      res.status(200).json({ results: [result], count: 1 });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Cleanup function to disconnect from Redis.
 * Call this during graceful server shutdown.
 */
export async function disconnectSearchService(): Promise<void> {
  await searchService.disconnect();
}

export { router as searchRouter };