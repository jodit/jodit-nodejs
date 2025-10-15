import type { Request, Response, NextFunction } from 'express';
import { Config, requestStorage } from '../config/config';

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

  // Helper to run next() within AsyncLocalStorage context
  const runWithRole = (role: string): void => {
    req.userRole = role;
    requestStorage.run({ userRole: role }, () => {
      next();
    });
  };

  // If no auth callback defined, use default role
  if (checkAuthentication == null) {
    runWithRole(config.params.defaultRole);
    return;
  }

  // Call authentication callback
  try {
    const roleOrPromise = checkAuthentication(req);

    if (roleOrPromise instanceof Promise) {
      roleOrPromise
        .then(role => {
          runWithRole(role);
        })
        .catch(next);
    } else {
      runWithRole(roleOrPromise);
    }
  } catch (error) {
    next(error);
  }
}
