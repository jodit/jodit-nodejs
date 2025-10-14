import type { Request, Response, NextFunction } from 'express';
import { RequestContext } from '../helpers/request-context';

declare module 'express-serve-static-core' {
  interface Request {
    context: RequestContext;
  }
}

export const requestContext = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const context = new RequestContext(req);
  req.context = context;
  next();
};
