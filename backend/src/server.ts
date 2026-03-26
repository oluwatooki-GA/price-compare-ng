import express, { Application } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/env';
import { swaggerSpec } from './config/swagger';
import { authRouter } from './api/v1/auth/routes';
import { searchRouter, disconnectSearchService } from './api/v1/search/routes';
import { comparisonRouter } from './api/v1/comparisons/routes';
import { errorHandler } from './middleware/errorHandler';
import { disconnectRedis } from './middleware/rateLimiter';

/**
 * Initialize Express application with middleware and routes
 */
function createApp(): Application {
  const app = express();

  // CORS middleware - allow requests from configured origins
  app.use(cors({
    origin: config.CORS_ORIGINS,
    credentials: true,
  }));

  // Body parser middleware - parse JSON request bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
  });

  // Swagger API documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'PriceCompare NG API Docs',
  }));

  // Register API v1 routers
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/comparisons', comparisonRouter);

  // Global error handler middleware (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the Express server
 */
async function startServer(): Promise<void> {
  const app = createApp();
  const port = config.PORT;

  const server = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📝 Environment: ${config.NODE_ENV}`);
    console.log(`🌐 CORS origins: ${config.CORS_ORIGINS.join(', ')}`);
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    
    // Close server to stop accepting new connections
    server.close(async () => {
      console.log('HTTP server closed');
      
      try {
        // Disconnect from Redis
        await disconnectRedis();
        console.log('Redis disconnected');
        
        // Disconnect search service (Redis cache)
        await disconnectSearchService();
        console.log('Search service disconnected');
        
        console.log('Shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { createApp, startServer };
