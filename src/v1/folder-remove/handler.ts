import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import fs from 'fs/promises';
import path from 'path';
import { FolderRemoveQuerySchema } from '../../schemas';
import { logger } from '../../helpers/logger';
import type { AppConfig } from '../../types';

/**
 * Recursively removes a directory and all its contents
 */
async function removeDirectory(dirPath: string): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await removeDirectory(fullPath);
    } else {
      await fs.unlink(fullPath);
    }
  }

  await fs.rmdir(dirPath);
}

/**
 * Handler for removing a folder
 * GET /?action=folderRemove&source=test&name=foldername&path=/
 */
export async function folderRemoveHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config: AppConfig = req.app.locals.config;

  // Validate query parameters
  const queryValidation = FolderRemoveQuerySchema.safeParse(req.query);
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
    `Removing folder: ${query.name} in ${sourceName}${query.path ?? '/'}`
  );

  // Construct folder path
  const requestPath = query.path ?? '/';
  const targetDir = path.join(sourceConfig.root, requestPath);
  const targetPath = path.join(targetDir, query.name);

  // Security check: ensure target path is within source root
  const realTargetPath = await fs.realpath(targetPath).catch(() => null);
  const realSourceRoot = await fs.realpath(sourceConfig.root);

  if (realTargetPath?.startsWith(realSourceRoot) !== true) {
    throw Boom.notFound('Directory not exists', ['Directory not exists']);
  }

  // Check if path exists
  const stats = await fs.stat(realTargetPath).catch(() => null);
  if (stats == null) {
    throw Boom.notFound('Directory not exists', ['Directory not exists']);
  }

  // Check if it's a directory
  if (!stats.isDirectory()) {
    const boomError = Boom.badRequest('It is not a directory!');
    boomError.output.payload.messages = ['It is not a directory!'];
    throw boomError;
  }

  // Remove thumbnails folder if exists
  const thumbFolderName = config.thumbFolderName || '_thumbs';
  const thumbPath = path.join(realTargetPath, thumbFolderName);
  const thumbStats = await fs.stat(thumbPath).catch(() => null);
  if (thumbStats?.isDirectory() === true) {
    await removeDirectory(thumbPath);
  }

  // Remove the directory
  await removeDirectory(realTargetPath);

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
