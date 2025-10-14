import type { Request, Response, NextFunction } from 'express';
import { Config } from '../config/config';

/**
 * Authentication callback that can set user role or throw an error
 */
export type AuthCallback = (req: Request) => string | Promise<string>;

declare module 'express-serve-static-core' {
  interface Request {
    userRole?: string;
  }
  interface Locals {
    config: Config;
    checkAuthentication?: AuthCallback;
  }
}

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const config = req.app.locals.config;
  const checkAuthentication = req.app.locals.checkAuthentication;

  // If no auth callback defined, use default role
  if (checkAuthentication == null) {
    req.userRole = config.params.defaultRole;
    next();
    return;
  }

  // Call authentication callback
  try {
    const roleOrPromise = checkAuthentication(req);

    if (roleOrPromise instanceof Promise) {
      roleOrPromise
        .then(role => {
          req.userRole = role;
          next();
        })
        .catch(next);
    } else {
      req.userRole = roleOrPromise;
      next();
    }
  } catch (error) {
    next(error);
  }
}
