import { Router, Response, NextFunction } from 'express';
import { authenticatedLimiter } from '../../../middleware/rateLimiter';
import { authenticateToken, AuthenticatedRequest } from '../../../middleware/auth';
import { ValidationError } from '../../../shared/errors';
import { RepositoryContainer } from '../../../repositories/RepositoryContainer';
import { TrackedProductService } from '../../../services/TrackedProductService';
import { prisma } from '../../../config/database';
import { TrackProductRequestSchema, UpdateAlertSettingsSchema } from './schemas';

const router = Router();

const repositoryContainer = RepositoryContainer.getInstance(prisma);
const trackedProductService = new TrackedProductService(
  repositoryContainer.getTrackedProductRepository(),
  repositoryContainer.getTrackedPriceHistoryRepository(),
);

router.post(
  '/',
  authenticatedLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ValidationError('User not authenticated');
      const parsed = TrackProductRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(`Validation failed: ${parsed.error.errors.map(e => e.message).join(', ')}`);
      }
      const { imageUrl, ...rest } = parsed.data;
      const result = await trackedProductService.trackProduct(req.user.userId, {
        ...rest,
        imageUrl: imageUrl ?? undefined,
      });
      res.status(201).json(result);
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
      const result = await trackedProductService.getUserTrackedProducts(req.user.userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:id/price-history',
  authenticatedLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ValidationError('User not authenticated');
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new ValidationError('Invalid tracked product ID');
      const history = await trackedProductService.getPriceHistory(req.user.userId, id);
      res.status(200).json(history);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/:id',
  authenticatedLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ValidationError('User not authenticated');
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new ValidationError('Invalid tracked product ID');
      const parsed = UpdateAlertSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(`Validation failed: ${parsed.error.errors.map(e => e.message).join(', ')}`);
      }
      const result = await trackedProductService.updateAlertSettings(req.user.userId, id, parsed.data);
      res.status(200).json(result);
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
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new ValidationError('Invalid tracked product ID');
      await trackedProductService.deleteTrackedProduct(req.user.userId, id);
      res.status(200).json({ success: true, message: 'Tracked product deleted successfully' });
    } catch (error) {
      next(error);
    }
  },
);

export { router as trackedProductsRouter };
