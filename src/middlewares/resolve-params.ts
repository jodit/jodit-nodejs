import type { Request, Response, NextFunction } from 'express';
import { mergeWithoutNulls } from '../helpers/merge-without-nulls';

declare module 'express-serve-static-core' {
  interface Request {
    params_data: Record<string, unknown>;
  }
}

/**
 * Middleware to resolve request parameters from either query string (GET) or body (POST)
 * and store them in req.params_data for handlers to use.
 *
 * This allows handlers to work with both GET and POST requests without checking req.method.
 */
export const resolveParams = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Choose params source based on request method
  req.params_data = mergeWithoutNulls(req.body, req.query);
  next();
};
