import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import fs from 'fs/promises';
import path from 'path';
import { FolderRenameQuerySchema } from '../../schemas';
import { logger } from '../../helpers/logger';

/**
 * Handler for renaming a folder
 * GET /?action=folderRename&source=test&name=old-name&newname=new-name&path=/
 */
export async function folderRenameHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate query parameters
  const queryValidation = FolderRenameQuerySchema.safeParse(req.params_data);
  if (queryValidation.success === false) {
    const messages = queryValidation.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = messages;
    throw boomError;
  }

  const query = queryValidation.data;

  logger.debug(
    `Renaming folder ${query.name} to ${query.newname} in ${req.sourceName}${query.path ?? '/'}`
  );

  // Construct paths
  const requestPath = query.path ?? '/';
  const parentDir = path.join(req.sourceConfig.root, requestPath);
  const fromPath = path.join(parentDir, query.name);
  let toPath = path.join(parentDir, query.newname);

  // Security check: ensure source is within root
  const realFromPath = await fs.realpath(fromPath).catch(() => null);
  const realSourceRoot = await fs.realpath(req.sourceConfig.root);

  if (realFromPath?.startsWith(realSourceRoot) !== true) {
    throw Boom.notFound('Folder or directory not exists', [
      'Folder or directory not exists'
    ]);
  }

  // Check if source exists
  const sourceStats = await fs.stat(realFromPath).catch(() => null);
  if (sourceStats == null) {
    throw Boom.notFound('Folder or directory not exists', [
      'Folder or directory not exists'
    ]);
  }

  // Check if it's a directory
  if (!sourceStats.isDirectory()) {
    const boomError = Boom.badRequest('It is not a directory!');
    boomError.output.payload.messages = ['It is not a directory!'];
    throw boomError;
  }

  // Check if destination already exists
  const destinationExists = await fs
    .access(toPath)
    .then(() => true)
    .catch(() => false);

  if (destinationExists) {
    const boomError = Boom.badRequest('Folder with new name already exists');
    boomError.output.payload.messages = ['Folder with new name already exists'];
    throw boomError;
  }

  // Rename the folder
  await fs.rename(realFromPath, toPath);

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
