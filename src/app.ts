import express, { Application, Request, Response, NextFunction } from 'express';
import Boom from '@hapi/boom';
import multer from 'multer';
import os from 'os';
import type { AppConfig } from './types';
import { config as defaultConfig } from './config';
import { logger } from './helpers/logger';
import { pingHandler } from './v1/ping/handler';
import { customConfigMiddleware } from './middlewares/custom-config';
import { corsMiddleware } from './middlewares/cors';
import { authMiddleware } from './middlewares/auth';
import { accessControlMiddleware } from './middlewares/access-control';
import { AppConfigSchema } from './schemas';
import { resolveAction } from './middlewares/resolve-action';
import { createMaybeApplyUploadMiddleware } from './middlewares/maybe-apply-upload';
import { actions } from './v1';

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
    
    throw Boom.badRequest(`Invalid application config: ${errors.join(', ')}`);
  }

  // Configure multer for file uploads
  const upload = multer({
    dest: os.tmpdir(),
    limits: {
      fileSize: 100 * 1024 * 1024 // 100MB max
    }
  });

  const app: Application = express()
    .disable('x-powered-by')
    .use(express.json())
    .use(express.urlencoded({ extended: true }));

  // Attach config to app.locals for use in handlers
  app.locals.config = config;

  // Apply middlewares
  app.use(corsMiddleware);
  app.use(customConfigMiddleware);
  app.use(authMiddleware);

  // Routes
  app.get('/ping', pingHandler);

  const maybeApplyUploadMiddleware = createMaybeApplyUploadMiddleware(upload);

  const postActionHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const action = req.action;

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
  app.post(
    '/',
    maybeApplyUploadMiddleware,
    resolveAction,
    accessControlMiddleware,
    postActionHandler
  );
  app.post(
    '/:action',
    maybeApplyUploadMiddleware,
    resolveAction,
    accessControlMiddleware,
    postActionHandler
  );

  const getActionHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const action = req.action;

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

  // Main API endpoint with validation
  app.get('/', resolveAction, accessControlMiddleware, getActionHandler);
  app.get('/:action', resolveAction, accessControlMiddleware, getActionHandler);

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
