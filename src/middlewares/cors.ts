import type { Request, Response, NextFunction } from 'express';

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
  if (typeof origin === 'string' && origin.length > 0) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin,X-Requested-With,Content-Type,Accept'
  );
  res.header('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.sendStatus(200);
    return;
  }

  next();
}
