import { Request, Response } from 'express';
import { PermissionsQuerySchema } from '../../schemas';
import { logger } from '../../helpers/logger';
import { validateParams } from '../../helpers/validate-params';

/**
 * Handler for getting permissions
 * GET /?action=permissions&source=test&path=/
 * POST / with body: { action: 'permissions', source: 'test', path: '/' }
 *
 * Note: Currently returns all permissions as allowed since access control
 * is not yet implemented. In the future, this should check actual permissions
 * based on user roles and access control configuration.
 */
export async function permissionsHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate parameters (already resolved by middleware)
  const query = validateParams(req.params_data, PermissionsQuerySchema);


  logger.debug(`Getting permissions for ${req.sourceName}${query.path ?? '/'}`);

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
