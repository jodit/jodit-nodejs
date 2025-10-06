import type { Request, Response, NextFunction } from 'express';
import Boom from '@hapi/boom';
import { AccessControl, type AccessControlRule } from '../helpers/access-control';
import type { AppConfig } from '../types';

export function accessControlMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const config = req.app.locals.config as AppConfig;

  // Skip access control if no rules defined
  if (config.accessControl == null || config.accessControl.length === 0) {
    next();
    return;
  }

  const accessControl = new AccessControl(config.accessControl as AccessControlRule[]);

  // Get user role from req (set by auth middleware) or use default
  // Note: userRole should be set by auth middleware, but fallback to defaultRole for safety
  const role = req.userRole ?? config.defaultRole;

  // Get action from query or body
  const action = (req.query.action ?? req.body?.action) as string | undefined;

  if (action == null || action === '') {
    next();
    return;
  }

  // Get path from query or body
  const pathValue = (req.query.path ?? req.body?.path) as string | undefined;
  const path = pathValue != null && pathValue !== '' ? pathValue : '/';

  // Get file extension if applicable
  const fileName = (req.query.name ?? req.body?.name) as string | undefined;
  const fileExtension = fileName != null && fileName !== '' ? fileName.split('.').pop() ?? '*' : '*';

  try {
    accessControl.checkPermission(role, action, path, fileExtension);
    next();
  } catch {
    const boomError = Boom.forbidden('Access denied');
    boomError.output.payload.messages = ['Access denied'];
    next(boomError);
  }
}
