import type { Request, Response, NextFunction } from 'express';
import Boom from '@hapi/boom';
import type { AppConfig, SourceConfig } from '../types';

declare module 'express-serve-static-core' {
  interface Request {
    sourceName: string;
    sourceConfig: SourceConfig;
  }
}

/**
 * Middleware to resolve the source name from request parameters.
 *
 * If source is provided and is a non-empty string, use it.
 * Otherwise, fall back to the default source from config.
 *
 * This correctly handles empty string values (which should use default),
 * unlike the ?? operator which only checks for null/undefined.
 */
export const resolveSource = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const config: AppConfig = req.app.locals.config;

  let providedSource: unknown = req.params_data.source;

  const sourceName =
    typeof providedSource === 'string' && providedSource.length > 0
      ? providedSource
      : config.defaultFilesKey;

  // Check if source exists
  if (!config.sources[sourceName]) {
    throw Boom.notFound('Source config not found')
  }

  req.sourceName = sourceName;
  req.sourceConfig = config.sources[sourceName];

  next();
};
