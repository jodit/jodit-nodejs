import type { Request, Response, NextFunction } from 'express';
import type { AppConfig } from '../types';

/**
 * Authentication callback that can set user role or throw an error
 */
export type AuthCallback = (req: Request) => string | Promise<string>;

declare module 'express-serve-static-core' {
  interface Request {
    userRole?: string;
  }
  interface Locals {
    config: AppConfig;
    checkAuthentication?: AuthCallback;
  }
}

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const config = req.app.locals.config as AppConfig;
  const checkAuthentication = req.app.locals.checkAuthentication;

  // If no auth callback defined, use default role
  if (checkAuthentication == null) {
    req.userRole = config.defaultRole;
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
