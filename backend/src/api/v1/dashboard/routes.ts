import { Router, Response, NextFunction } from 'express';
import { authenticatedLimiter } from '../../../middleware/rateLimiter';
import { authenticateToken, AuthenticatedRequest } from '../../../middleware/auth';
import { ValidationError } from '../../../shared/errors';
import { RepositoryContainer } from '../../../repositories/RepositoryContainer';
import { TrackedProductService } from '../../../services/TrackedProductService';
import { prisma } from '../../../config/database';

const router = Router();

const repositoryContainer = RepositoryContainer.getInstance(prisma);
const trackedProductService = new TrackedProductService(
  repositoryContainer.getTrackedProductRepository(),
  repositoryContainer.getTrackedPriceHistoryRepository(),
);

router.get(
  '/',
  authenticatedLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ValidationError('User not authenticated');
      const summary = await trackedProductService.getDashboardSummary(req.user.userId);
      res.status(200).json({ trackedProducts: summary, count: summary.length });
    } catch (error) {
      next(error);
    }
  },
);

export { router as dashboardRouter };
