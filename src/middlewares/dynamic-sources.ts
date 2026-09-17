import type { Request, Response, NextFunction } from 'express';
import { requestStorage } from '../config/config';

/**
 * Multi-tenant mode: ask `config.resolveSources` which sources this request
 * may see and pin them to the request via AsyncLocalStorage. Must run before
 * `authMiddleware`, which keeps the store and only adds the role.
 */
export function dynamicSourcesMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const config = req.app.locals.config;

  if (config.params.resolveSources === undefined) {
    next();
    return;
  }

  config
    .resolveRequestSources(req)
    .then(sources => {
      if (sources === null) {
        next();
        return;
      }

      requestStorage.run(
        {
          userRole:
            requestStorage.getStore()?.userRole ?? config.params.defaultRole,
          sources
        },
        () => {
          next();
        }
      );
    })
    .catch(next);
}
