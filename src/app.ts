import express, { Application, Request, Response, NextFunction } from 'express';
import Boom from '@hapi/boom';
import type { AppConfig } from './types';
import { config as defaultConfig } from './config';
import { logger } from './helpers/logger';
import { filesHandler } from './v1/files';
import { pingHandler } from './v1/ping';
import { validateQuery } from './middlewares/validate-query';
import { customConfigMiddleware } from './middlewares/custom-config';
import { corsMiddleware } from './middlewares/cors';
import { BaseActionQueryPassthroughSchema, AppConfigSchema } from './schemas';

export function createApp(customConfig?: Partial<AppConfig>): Application {
  const config: AppConfig =
    customConfig !== undefined
      ? { ...defaultConfig, ...customConfig }
      : defaultConfig;

  // Validate config on startup
  const validation = AppConfigSchema.safeParse(config);
  if (!validation.success) {
    const errors = validation.error.issues.map(
      err => `${err.path.join('.')}: ${err.message}`
    );
    logger.error(`Invalid application config: ${errors.join(', ')}`);
    throw new Error(`Invalid application config: ${errors.join(', ')}`);
  }

  const app: Application = express()
    .disable('x-powered-by')
    .use(express.json())
    .use(express.urlencoded({ extended: true }));

  // Attach config to app.locals for use in handlers
  app.locals.config = config;

  // Apply middlewares
  app.use(corsMiddleware);
  app.use(customConfigMiddleware);

  // Routes
  app.get('/ping', pingHandler);

  // Main API endpoint with validation
  app.get(
    '/',
    validateQuery(BaseActionQueryPassthroughSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const action = req.query.action as string;

        switch (action) {
          case 'files':
            await filesHandler(req, res);
            break;
          default: {
            const boomError = Boom.notFound(`Action "${action}" not found`);
            boomError.output.payload.messages = [boomError.message];
            throw boomError;
          }
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (config.debug === true) {
      logger.error(err.message);
      logger.debug(err.stack ?? 'No stack trace');
    }

    // Check if it's a Boom error
    if (Boom.isBoom(err)) {
      const statusCode = err.output.statusCode;
      const messages = (err.output.payload as { messages?: string[] })
        .messages ?? [err.message];

      res.status(statusCode).json({
        success: false,
        data: {
          code: statusCode,
          messages
        }
      });
      return;
    }

    // Handle regular errors
    res.status(500).json({
      success: false,
      data: {
        code: 500,
        messages: [err.message]
      }
    });
  });

  return app;
}
