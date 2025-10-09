import type { Request, Response, NextFunction } from 'express';
import Boom from '@hapi/boom';

declare module 'express-serve-static-core' {
  interface Request {
    action?: string;
  }
}

export const resolveAction = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (typeof req.params?.action === 'string') {
    req.action = req.params.action.trim();
  } else if (typeof req.query?.action === 'string') {
    req.action = req.query.action.trim();
  } else if (typeof req.body?.action === 'string') {
    req.action = req.body.action.trim();
  }

  if (req.action == null || req.action == '') {
    throw Boom.badRequest('Action parameter is required');
  }

  next();
};
