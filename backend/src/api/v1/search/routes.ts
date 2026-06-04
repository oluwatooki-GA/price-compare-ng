import { Router, Request, Response, NextFunction } from 'express';
import { KeywordSearchRequestSchema, UrlSearchRequestSchema } from './schemas';
import { ValidationError } from '../../../shared/errors';
import { unauthenticatedLimiter, authenticatedLimiter } from '../../../middleware/rateLimiter';
import { verifyToken } from '../../../config/security';
import { SearchSubmitService } from '../../../services/SearchSubmitService';
import { ScrapeJobRepository } from '../../../repositories/ScrapeJobRepository';
import { scrapeQueue } from '../../../queue';
import { prisma } from '../../../config/database';
import type { ScrapeJobData } from '../../../queue/types';

const router = Router();

const jobRepository = new ScrapeJobRepository(prisma);
export const searchSubmitService = new SearchSubmitService(jobRepository, scrapeQueue);

interface OptionalAuthRequest extends Request {
  user?: { userId: number; email: string };
}

function optionalAuth(req: OptionalAuthRequest, _res: Response, next: NextFunction): void {
  try {
    const parts = req.headers.authorization?.split(' ');
    if (parts?.length === 2 && parts[0] === 'Bearer') {
      const payload = verifyToken(parts[1]);
      if (payload) req.user = { userId: payload.userId, email: payload.email };
    }
  } catch { /* ignore invalid tokens */ }
  next();
}

function applyRateLimit(req: OptionalAuthRequest, res: Response, next: NextFunction): void {
  if (req.user) {
    authenticatedLimiter(req, res, next);
  } else {
    unauthenticatedLimiter(req, res, next);
  }
}

router.post(
  '/keyword',
  optionalAuth,
  applyRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = KeywordSearchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(`Validation failed: ${parsed.error.errors.map(e => e.message).join(', ')}`);
      }
      const { keyword, ...rawFilters } = parsed.data;
      const result = await searchSubmitService.submitKeyword(keyword, rawFilters as ScrapeJobData['filters']);
      const statusCode = result.results ? 200 : 202;
      return res.status(statusCode).json(result);
    } catch (err) {
      return next(err);
    }
  },
);

router.post(
  '/url',
  optionalAuth,
  applyRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = UrlSearchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(`Validation failed: ${parsed.error.errors.map(e => e.message).join(', ')}`);
      }
      const { url } = parsed.data;
      const result = await searchSubmitService.submitUrl(url);
      const statusCode = result.results ? 200 : 202;
      return res.status(statusCode).json(result);
    } catch (err) {
      return next(err);
    }
  },
);

// No-op — SearchService now lives in the worker process
export async function disconnectSearchService(): Promise<void> {}

export { router as searchRouter };
