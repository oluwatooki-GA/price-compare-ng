import { initSentry, Sentry } from './config/sentry';
initSentry('backend');

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config/env';
import { swaggerSpec } from './config/swagger';
import { connectRedis, disconnectRedis } from './config/redis';
import { logger } from './config/logger';
import { registry, httpRequestDuration } from './config/metrics';
import { authRouter } from './api/v1/auth/routes';
import { searchRouter, disconnectSearchService } from './api/v1/search/routes';
import { comparisonRouter } from './api/v1/comparisons/routes';
import { jobsRouter } from './api/v1/jobs/routes';
import { trackedProductsRouter } from './api/v1/tracked-products/routes';
import { dashboardRouter } from './api/v1/dashboard/routes';
import { errorHandler } from './middleware/errorHandler';
import { enableRedisRateLimiting } from './middleware/rateLimiter';
import { scrapeQueue } from './queue';

function createApp(): Application {
  const app = express();

  app.use(cors({ origin: config.CORS_ORIGINS, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // HTTP request duration metric
  app.use((req: Request, res: Response, next: NextFunction) => {
    const end = httpRequestDuration.startTimer({ method: req.method });
    res.on('finish', () => {
      end({ route: req.route?.path ?? req.path, status: String(res.statusCode) });
    });
    next();
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'PriceCompare NG API Docs',
  }));

  const boardAdapter = new ExpressAdapter();
  boardAdapter.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(scrapeQueue)], serverAdapter: boardAdapter });
  app.use('/admin/queues', boardAdapter.getRouter());

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/comparisons', comparisonRouter);
  app.use('/api/v1/jobs', jobsRouter);
  app.use('/api/v1/tracked-products', trackedProductsRouter);
  app.use('/api/v1/dashboard', dashboardRouter);

  Sentry.setupExpressErrorHandler(app);
  app.use(errorHandler);

  return app;
}

async function startServer(): Promise<void> {
  await connectRedis();
  enableRedisRateLimiting();

  const app = createApp();
  const port = config.PORT;

  const server = app.listen(port, () => {
    logger.info({ port, env: config.NODE_ENV }, 'Server started');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(async () => {
      try {
        await disconnectRedis();
        await disconnectSearchService();
        await scrapeQueue.close();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ err: error }, 'Error during shutdown');
        process.exit(1);
      }
    });
    setTimeout(() => { logger.error('Forced shutdown after timeout'); process.exit(1); }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

if (require.main === module) {
  startServer().catch(error => { logger.error({ err: error }, 'Failed to start server'); process.exit(1); });
}

export { createApp, startServer };
