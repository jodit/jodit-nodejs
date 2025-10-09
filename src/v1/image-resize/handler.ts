import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { ImageResizeQuerySchema } from '../../schemas';
import { logger } from '../../helpers/logger';
import type { AppConfig } from '../../types';

/**
 * Handler for resizing images
 * GET /?action=imageResize&source=test&name=image.jpg&box[w]=800&box[h]=600
 */
export async function imageResizeHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config: AppConfig = req.app.locals.config;

  // Validate query parameters
  const queryValidation = ImageResizeQuerySchema.safeParse(req.query);
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
  if (sourceConfig == null) {
    throw Boom.notFound('Source not found', ['Source not found']);
  }

  logger.debug(
    `Resizing image: ${query.name} to ${query.box.w}x${query.box.h}`
  );

  // Construct file path
  const requestPath = query.path ?? '/';
  const targetDir = path.join(sourceConfig.root, requestPath);
  const targetPath = path.join(targetDir, query.name);

  // Security check: ensure target path is within source root
  const realTargetPath = await fs.realpath(targetPath).catch(() => null);
  const realSourceRoot = await fs.realpath(sourceConfig.root);

  if (realTargetPath?.startsWith(realSourceRoot) !== true) {
    throw Boom.notFound('File not exists', ['File not exists']);
  }

  // Check if file exists and is a file
  const stats = await fs.stat(realTargetPath).catch(() => null);
  if (stats?.isFile() !== true) {
    throw Boom.notFound('File not exists', ['File not exists']);
  }

  // Check if width and height are valid
  if (query.box.w == null || query.box.w <= 0) {
    const boomError = Boom.badRequest('Width not specified');
    boomError.output.payload.messages = ['Width not specified'];
    throw boomError;
  }

  if (query.box.h == null || query.box.h <= 0) {
    const boomError = Boom.badRequest('Height not specified');
    boomError.output.payload.messages = ['Height not specified'];
    throw boomError;
  }

  // Determine output filename
  let newName = query.newname ?? query.name;
  const ext = path.extname(query.name);

  // Preserve extension if not present in newname
  if (newName.endsWith(ext) !== true) {
    newName = newName + ext;
  }

  const outputPath = path.join(targetDir, newName);

  // Check if output file already exists (unless we're replacing the source file)
  if (newName !== query.name && !config.allowReplaceSourceFile) {
    const exists = await fs
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      const boomError = Boom.badRequest(`File ${newName} already exists`);
      boomError.output.payload.messages = [`File ${newName} already exists`];
      throw boomError;
    }
  }

  // Resize image using sharp
  try {
    // If resizing in place, use a temporary file first
    const isSameFile = newName === query.name;
    const tempOutputPath = isSameFile ? `${outputPath}.tmp` : outputPath;

    await sharp(realTargetPath)
      .resize(query.box.w, query.box.h, {
        fit: 'fill'
      })
      .toFile(tempOutputPath);

    // If we used a temp file, move it to the final location
    if (isSameFile) {
      await fs.rename(tempOutputPath, outputPath);
    }
  } catch (error) {
    logger.error(`Failed to resize image: ${error}`);
    throw Boom.internal('Failed to resize image', ['Failed to resize image']);
  }

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
