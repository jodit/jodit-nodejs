import express, { Application, Request, Response, NextFunction } from 'express';
import Boom from '@hapi/boom';
import type { AppConfig } from './types';
import { config as defaultConfig } from './config';
import { logger } from './helpers/logger';
import { pingHandler } from './v1/ping/handler';
import { corsMiddleware } from './middlewares/cors';
import { authMiddleware } from './middlewares/auth';
import { AppConfigSchema } from './schemas';
import { actions } from './v1';
import { Config } from './config/config';
import { requestContext } from './middlewares/request-context';

export function createApp(customConfig?: Partial<AppConfig>): Application {
  const appConfig: AppConfig =
    customConfig !== undefined
      ? { ...defaultConfig, ...customConfig }
      : defaultConfig;

  // Validate config on startup
  const validation = AppConfigSchema.safeParse(appConfig);
  if (!validation.success) {
    const errors = validation.error.issues.map(
      err => `${err.path.join('.')}: ${err.message}`
    );

    logger.error(`Invalid application config: ${errors.join(', ')}`);

    throw Boom.badRequest(`Invalid application config: ${errors.join(', ')}`);
  }

  const app: Application = express()
    .disable('x-powered-by')
    .use(express.json())
    .use(express.urlencoded({ extended: true }));

  app.locals.config = new Config(appConfig);

  // Apply middlewares
  app.use(corsMiddleware);
  app.use(authMiddleware);

  // Routes
  app.get('/ping', pingHandler);

  const actionHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const action = req.context.action;

      await app.locals.config.access.checkPermission(
        await app.locals.config.getUserRole(),
        action,
        req.context.path
      );

      const handler = actions[action as keyof typeof actions];

      if (handler != null) {
        await handler(req, res);
      } else {
        const boomError = Boom.notFound(`Action "${action}" not found`);
        boomError.output.payload.messages = [boomError.message];
        throw boomError;
      }
    } catch (error) {
      next(error);
    }
  };

  // POST endpoint for file uploads and other actions
  app.post('/', requestContext, actionHandler);
  app.post('/:action', requestContext, actionHandler);
  // Main API endpoint with validation
  app.get('/', requestContext, actionHandler);
  app.get('/:action', requestContext, actionHandler);

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (app.locals.config.params.debug === true) {
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
