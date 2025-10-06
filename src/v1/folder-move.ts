import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import fs from 'fs/promises';
import path from 'path';
import { FolderMoveQuerySchema } from '../schemas';
import { logger } from '../helpers/logger';
import type { AppConfig } from '../types';

/**
 * Handler for moving a folder to a different location
 * GET /?action=folderMove&source=test&from=/folder-name&path=/new-location/
 */
export async function folderMoveHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config: AppConfig = req.app.locals.config;

  // Validate query parameters
  const queryValidation = FolderMoveQuerySchema.safeParse(req.query);
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

  logger.debug(
    `Moving folder from ${query.from} to ${query.path ?? '/'} in ${sourceName}`
  );

  // Construct source and destination paths
  const sourcePath = path.join(sourceConfig.root, query.from);
  const destinationDir = path.join(sourceConfig.root, query.path ?? '/');
  const folderName = path.basename(query.from);
  const destinationPath = path.join(destinationDir, folderName);

  // Security check: ensure source is within root
  const realSourcePath = await fs.realpath(sourcePath).catch(() => null);
  const realSourceRoot = await fs.realpath(sourceConfig.root);

  if (realSourcePath?.startsWith(realSourceRoot) !== true) {
    throw Boom.notFound('Folder or directory not exists', [
      'Folder or directory not exists'
    ]);
  }

  // Check if source exists
  const sourceStats = await fs.stat(realSourcePath).catch(() => null);
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

  // Security check: ensure destination directory is within root
  const realDestinationDir = await fs
    .realpath(destinationDir)
    .catch(() => null);

  if (realDestinationDir?.startsWith(realSourceRoot) !== true) {
    throw Boom.notFound('Destination directory not found', [
      'Destination directory not found'
    ]);
  }

  // Check if destination already exists
  const destinationExists = await fs
    .access(destinationPath)
    .then(() => true)
    .catch(() => false);

  if (destinationExists) {
    const boomError = Boom.badRequest(
      'Folder with same name already exists in destination'
    );
    boomError.output.payload.messages = [
      'Folder with same name already exists in destination'
    ];
    throw boomError;
  }

  // Move the folder
  await fs.rename(realSourcePath, destinationPath);

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
