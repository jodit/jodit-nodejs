import type { Request, Response, NextFunction } from 'express';
import type { AllowedOrigins } from '../types';

const ALLOWED_HEADERS =
  'Origin,X-Requested-With,Content-Type,Accept,Authorization';

async function isOriginAllowed(
  origin: string,
  allowedOrigins: AllowedOrigins | undefined,
  req: Request
): Promise<boolean> {
  if (allowedOrigins === undefined) {
    return true;
  }

  if (typeof allowedOrigins === 'function') {
    return allowedOrigins(origin, req);
  }

  return allowedOrigins.includes(origin);
}

export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const config = req.app.locals.config;

  // Only apply CORS if enabled in config
  if (config.params.allowCrossOrigin !== true) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const hasOrigin = typeof origin === 'string' && origin.length > 0;

  const apply = (allowed: boolean): void => {
    if (!allowed) {
      // Not an allowed origin: answer without CORS headers so the browser
      // blocks the response, and refuse the preflight outright.
      if (req.method === 'OPTIONS') {
        res.sendStatus(403);
        return;
      }

      next();
      return;
    }

    res.header('Access-Control-Allow-Origin', hasOrigin ? origin : '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.header('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.sendStatus(200);
      return;
    }

    next();
  };

  if (!hasOrigin) {
    apply(true);
    return;
  }

  isOriginAllowed(origin, config.params.allowedOrigins, req)
    .then(apply)
    .catch(next);
}
