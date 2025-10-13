import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import fs from 'fs/promises';
import path from 'path';
import { FolderCreateQuerySchema } from '../../schemas';
import { logger } from '../../helpers/logger';

/**
 * Handler for creating a new folder
 * GET /?action=folderCreate&source=test&name=newfolder&path=/
 */
export async function folderCreateHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate query parameters
  const queryValidation = FolderCreateQuerySchema.safeParse(req.params_data);
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
    `Creating folder: ${query.name} in ${req.sourceName}${query.path ?? '/'}`
  );

  // Construct destination path
  const requestPath = query.path ?? '/';
  const destinationDir = path.join(req.sourceConfig.root, requestPath);

  // Security check: ensure destination directory is within source root
  const realDestinationDir = await fs
    .realpath(destinationDir)
    .catch(() => null);
  const realSourceRoot = await fs.realpath(req.sourceConfig.root);

  if (realDestinationDir?.startsWith(realSourceRoot) !== true) {
    throw Boom.notFound('Directory not found', ['Directory not found']);
  }

  // Validate folder name
  if (query.name.trim() === '') {
    const boomError = Boom.badRequest(
      'The name for new directory has not been set'
    );
    boomError.output.payload.messages = [
      'The name for new directory has not been set'
    ];
    throw boomError;
  }

  // Make folder name safe (remove path separators and dangerous characters)
  const safeFolderName = query.name.replace(/[/\\:*?"<>|]/g, '_');

  const newFolderPath = path.join(destinationDir, safeFolderName);

  // Check if folder already exists
  const existingFolder = await fs.realpath(newFolderPath).catch(() => null);
  if (existingFolder !== null) {
    const boomError = Boom.badRequest('Directory already exists');
    boomError.output.payload.messages = ['Directory already exists'];
    throw boomError;
  }

  // Create the folder
  try {
    await fs.mkdir(newFolderPath, { recursive: false });
  } catch (error) {
    logger.error(`Failed to create directory: ${error}`);
    throw Boom.internal('Directory was not created', [
      'Directory was not created'
    ]);
  }

  // Verify folder was created
  const stats = await fs.stat(newFolderPath).catch(() => null);
  if (stats?.isDirectory() !== true) {
    throw Boom.internal('Directory was not created', [
      'Directory was not created'
    ]);
  }

  res.json({
    success: true,
    data: {
      code: 220,
      messages: ['Directory successfully created']
    }
  });
}
