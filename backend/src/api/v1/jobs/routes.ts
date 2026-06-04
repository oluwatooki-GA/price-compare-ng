import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../../config/database';
import { ResourceNotFoundError } from '../../../shared/errors';

const router = Router();

router.get('/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.scrapeJob.findUnique({ where: { id: req.params.jobId } });
    if (!job) throw new ResourceNotFoundError(`Job ${req.params.jobId} not found`);

    res.json({
      jobId:       job.id,
      status:      job.status,
      results:     job.results ?? null,
      error:       job.error ?? null,
      createdAt:   job.createdAt,
      completedAt: job.completedAt ?? null,
    });
  } catch (err) {
    next(err);
  }
});

export { router as jobsRouter };
