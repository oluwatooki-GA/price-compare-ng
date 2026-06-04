import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../../config/database';
import { KeywordSearchRequestSchema, UrlSearchRequestSchema } from './schemas';
import { ValidationError } from '../../../shared/errors';
import {
  unauthenticatedLimiter,
  authenticatedLimiter,
} from '../../../middleware/rateLimiter';
import { scrapeQueue } from '../../../queue';
import { verifyToken } from '../../../config/security';
import type { ScrapeJobData } from '../../../queue/types';

const router = Router();

const RECENT_JOB_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function buildFiltersKey(filters: Record<string, unknown>): string {
  return JSON.stringify({
    minPrice:      filters.minPrice      ?? null,
    maxPrice:      filters.maxPrice      ?? null,
    platforms:     Array.isArray(filters.platforms)
                     ? [...(filters.platforms as string[])].sort()
                     : null,
    minRating:     filters.minRating     ?? null,
    availableOnly: filters.availableOnly ?? null,
    limit:         filters.limit         ?? null,
  });
}

interface OptionalAuthRequest extends Request {
  user?: { userId: number; email: string };
}

function optionalAuth(
  req: OptionalAuthRequest,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const parts = req.headers.authorization?.split(' ');
    if (parts?.length === 2 && parts[0] === 'Bearer') {
      const payload = verifyToken(parts[1]);
      if (payload) req.user = { userId: payload.userId, email: payload.email };
    }
  } catch { /* ignore invalid tokens */ }
  next();
}

function applyRateLimit(
  req: OptionalAuthRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.user) {
    authenticatedLimiter(req, res, next);
  } else {
    unauthenticatedLimiter(req, res, next);
  }
}

// POST /search/keyword
router.post(
  '/keyword',
  optionalAuth,
  applyRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = KeywordSearchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          `Validation failed: ${parsed.error.errors.map(e => e.message).join(', ')}`,
        );
      }

      const { keyword, ...rawFilters } = parsed.data;
      const query      = keyword.trim().toLowerCase();
      const filtersKey = buildFiltersKey(rawFilters as Record<string, unknown>);
      const filters    = rawFilters as ScrapeJobData['filters'];

      // 1. Recent completed job for the same query+filters → return immediately
      const cached = await prisma.scrapeJob.findFirst({
        where: {
          query,
          queryType: 'keyword',
          filtersKey,
          status: 'COMPLETED',
          completedAt: { gte: new Date(Date.now() - RECENT_JOB_WINDOW_MS) },
        },
        orderBy: { completedAt: 'desc' },
      });
      if (cached) {
        const results = cached.results as unknown[];
        return res.json({ jobId: cached.id, status: 'COMPLETED', results, count: results.length });
      }

      // 2. Existing pending/running job → return its ID (no duplicate)
      const active = await prisma.scrapeJob.findFirst({
        where: {
          query,
          queryType: 'keyword',
          filtersKey,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });
      if (active) {
        return res.status(202).json({ jobId: active.id, status: active.status });
      }

      // 3. Create and enqueue a new job
      const dbJob = await prisma.scrapeJob.create({
        data: { query, queryType: 'keyword', filtersKey, status: 'PENDING' },
      });

      const jobData: ScrapeJobData = { jobDbId: dbJob.id, query, queryType: 'keyword', filters };
      await scrapeQueue.add('keyword', jobData, { jobId: dbJob.id });

      return res.status(202).json({ jobId: dbJob.id, status: 'PENDING' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /search/url
router.post(
  '/url',
  optionalAuth,
  applyRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = UrlSearchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          `Validation failed: ${parsed.error.errors.map(e => e.message).join(', ')}`,
        );
      }

      const { url }    = parsed.data;
      const filtersKey = '{}'; // URL search has no filter variants

      // 1. Recent completed job
      const cached = await prisma.scrapeJob.findFirst({
        where: {
          query: url,
          queryType: 'url',
          filtersKey,
          status: 'COMPLETED',
          completedAt: { gte: new Date(Date.now() - RECENT_JOB_WINDOW_MS) },
        },
        orderBy: { completedAt: 'desc' },
      });
      if (cached) {
        const results = cached.results as unknown[];
        return res.json({ jobId: cached.id, status: 'COMPLETED', results, count: results.length });
      }

      // 2. Existing active job
      const active = await prisma.scrapeJob.findFirst({
        where: { query: url, queryType: 'url', filtersKey, status: { in: ['PENDING', 'RUNNING'] } },
      });
      if (active) {
        return res.status(202).json({ jobId: active.id, status: active.status });
      }

      // 3. Create and enqueue
      const dbJob = await prisma.scrapeJob.create({
        data: { query: url, queryType: 'url', filtersKey, status: 'PENDING' },
      });

      const jobData: ScrapeJobData = { jobDbId: dbJob.id, query: url, queryType: 'url', filters: {} };
      await scrapeQueue.add('url', jobData, { jobId: dbJob.id });

      return res.status(202).json({ jobId: dbJob.id, status: 'PENDING' });
    } catch (err) {
      next(err);
    }
  },
);

// No-op — SearchService now lives in the worker process, not the API
export async function disconnectSearchService(): Promise<void> {}

export { router as searchRouter };
