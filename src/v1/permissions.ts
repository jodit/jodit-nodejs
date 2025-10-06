import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { PermissionsQuerySchema } from '../schemas';
import { logger } from '../helpers/logger';
import type { AppConfig } from '../types';

/**
 * Handler for getting permissions
 * GET /?action=permissions&source=test&path=/
 *
 * Note: Currently returns all permissions as allowed since access control
 * is not yet implemented. In the future, this should check actual permissions
 * based on user roles and access control configuration.
 */
export async function permissionsHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config: AppConfig = req.app.locals.config;

  // Validate query parameters
  const queryValidation = PermissionsQuerySchema.safeParse(req.query);
  if (queryValidation.success === false) {
    const messages = queryValidation.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = messages;
    throw boomError;
  }

  const query = queryValidation.data;
  const sourceName = query.source ?? config.defaultFilesKey;

  // Get source configuration
  const sourceConfig = config.sources?.[sourceName];
  if (sourceConfig === undefined) {
    throw Boom.notFound('Source not found', ['Source not found']);
  }

  logger.debug(`Getting permissions for ${sourceName}${query.path ?? '/'}`);

  // Default permissions list (matching PHP version)
  // TODO: Implement actual access control checking
  const permissions = {
    allowFiles: true,
    allowFileMove: true,
    allowFileUpload: true,
    allowFileUploadRemote: true,
    allowFileRemove: true,
    allowFileRename: true,
    allowFolders: true,
    allowFolderMove: true,
    allowFolderCreate: true,
    allowFolderRemove: true,
    allowFolderRename: true,
    allowImageResize: true,
    allowImageCrop: true
  };

  res.json({
    success: true,
    data: {
      code: 220,
      permissions
    }
  });
}
