import type { Request, Response } from 'express';
import type { AppConfig } from '../types';
import Boom from '@hapi/boom';
import { FileRemoveQuerySchema } from '../schemas';
import path from 'path';
import fs from 'fs/promises';

export async function fileRemoveHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config as AppConfig;

  // Validate query params
  const queryValidation = FileRemoveQuerySchema.safeParse(req.query);
  if (queryValidation.success === false) {
    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  const query = queryValidation.data;
  const sourceName = query.source ?? config.defaultFilesKey;

  // Check if source exists
  if (config.sources[sourceName] === undefined) {
    const boomError = Boom.notFound('Source not found');
    boomError.output.payload.messages = ['Source not found'];
    throw boomError;
  }

  const sourceConfig = config.sources[sourceName];
  const sourcePath = query.path ?? '/';

  // Validate and get file path
  const targetPath = path.join(sourceConfig.root, sourcePath, query.name);

  // Security check: ensure file is within source root
  const realTargetPath = await fs.realpath(targetPath).catch(() => null);
  const realSourceRoot = await fs.realpath(sourceConfig.root);

  if (realTargetPath?.startsWith(realSourceRoot) !== true) {
    const boomError = Boom.notFound('File or directory not exists');
    boomError.output.payload.messages = [
      `File or directory not exists ${sourcePath}${query.name}`
    ];
    throw boomError;
  }

  // Check if file exists
  const stats = await fs.stat(realTargetPath).catch(() => null);
  if (stats == null) {
    const boomError = Boom.notFound('File or directory not exists');
    boomError.output.payload.messages = [
      `File or directory not exists ${sourcePath}${query.name}`
    ];
    throw boomError;
  }

  // Check if it's a file
  if (!stats.isFile()) {
    const boomError = Boom.badRequest('It is not a file!');
    boomError.output.payload.messages = ['It is not a file!'];
    throw boomError;
  }

  // Remove file
  try {
    await fs.unlink(realTargetPath);
  } catch (error) {
    const boomError = Boom.internal('Delete failed!');
    boomError.output.payload.messages = [
      `Delete failed! ${error instanceof Error ? error.message : 'Unknown error'}`
    ];
    throw boomError;
  }

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
