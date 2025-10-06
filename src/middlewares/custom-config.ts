import type { Request, Response, NextFunction } from 'express';
import type { AppConfig } from '../types';
import Boom from '@hapi/boom';
import { logger } from '../helpers/logger';
import { AppConfigSchema } from '../schemas';

export function customConfigMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const currentConfig = req.app.locals.config as AppConfig;

  // Only allow custom_config in debug mode
  if (currentConfig.debug !== true) {
    next();
    return;
  }

  const customConfigParam = req.query.custom_config as string | undefined;

  if (typeof customConfigParam === 'string' && customConfigParam.length > 0) {
    try {
      const parsedConfig = JSON.parse(customConfigParam);

      if (typeof parsedConfig !== 'object' || parsedConfig === null) {
        const boomError = Boom.badRequest('custom_config must be an object');
        boomError.output.payload.messages = ['custom_config must be an object'];
        next(boomError);
        return;
      }

      const mergedConfig = { ...currentConfig, ...parsedConfig };

      // Validate merged config
      const validation = AppConfigSchema.safeParse(mergedConfig);

      if (!validation.success) {
        const errors = validation.error.issues.map(
          err => `${err.path.join('.')}: ${err.message}`
        );
        logger.warn(`Invalid custom_config: ${errors.join(', ')}`);

        const boomError = Boom.badRequest('Invalid custom_config');
        boomError.output.payload.messages = errors;
        next(boomError);
        return;
      }

      // Apply validated config
      req.app.locals.config = validation.data;
      logger.debug(`Custom config applied: ${customConfigParam}`);
    } catch (error) {
      logger.warn(
        `Failed to parse custom_config: ${error instanceof Error ? error.message : String(error)}`
      );

      const boomError = Boom.badRequest('Failed to parse custom_config');
      boomError.output.payload.messages = [
        error instanceof Error ? error.message : String(error)
      ];
      next(boomError);
      return;
    }
  }

  next();
}
