import { Router, Response, NextFunction } from 'express';
import { ComparisonService } from '../../../services/ComparisonService';
import { SaveComparisonRequestSchema } from './schemas';
import { ValidationError } from '../../../shared/errors';
import { authenticatedLimiter } from '../../../middleware/rateLimiter';
import { authenticateToken, AuthenticatedRequest } from '../../../middleware/auth';
import { RepositoryContainer } from '../../../repositories/RepositoryContainer';
import { prisma } from '../../../config/database';

const router = Router();

const repositoryContainer = RepositoryContainer.getInstance(prisma);
const comparisonService = new ComparisonService(repositoryContainer.getSavedComparisonRepository());

router.post(
  '/',
  authenticatedLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ValidationError('User not authenticated');
      const validationResult = SaveComparisonRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
        throw new ValidationError(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
      }
      const { comparisonData } = validationResult.data;
      const savedComparison = await comparisonService.saveComparison(req.user.userId, comparisonData);
      res.status(201).json(savedComparison);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/',
  authenticatedLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ValidationError('User not authenticated');
      const comparisons = await comparisonService.getUserComparisons(req.user.userId);
      res.status(200).json(comparisons);
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/:id',
  authenticatedLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ValidationError('User not authenticated');
      const comparisonId = parseInt(req.params.id, 10);
      if (isNaN(comparisonId)) throw new ValidationError('Invalid comparison ID');
      await comparisonService.deleteComparison(req.user.userId, comparisonId);
      res.status(200).json({ success: true, message: 'Comparison deleted successfully' });
    } catch (error) {
      next(error);
    }
  },
);

export { router as comparisonRouter };
