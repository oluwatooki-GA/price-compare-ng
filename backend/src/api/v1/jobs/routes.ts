import { Router, Request, Response, NextFunction } from 'express';
import { searchSubmitService } from '../search/routes';

const router = Router();

router.get('/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await searchSubmitService.getJobStatus(req.params.jobId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export { router as jobsRouter };
