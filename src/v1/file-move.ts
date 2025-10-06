import type { Request, Response } from 'express';
import type { AppConfig } from '../types';
import Boom from '@hapi/boom';
import { FileMoveQuerySchema } from '../schemas';
import path from 'path';
import fs from 'fs/promises';

export async function fileMoveHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config as AppConfig;

  // Validate query params
  const queryValidation = FileMoveQuerySchema.safeParse(req.query);
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
  const destinationPath = query.path ?? '/';

  if (query.from === '') {
    const boomError = Boom.badRequest('Need source path');
    boomError.output.payload.messages = ['Need source path'];
    throw boomError;
  }

  // Build source and destination paths
  const sourceFullPath = path.join(sourceConfig.root, query.from);
  const destDirPath = path.join(sourceConfig.root, destinationPath);

  // Security check: ensure paths are within source root
  const realSourcePath = await fs.realpath(sourceFullPath).catch(() => null);
  const realDestPath = await fs.realpath(destDirPath).catch(() => null);
  const realSourceRoot = await fs.realpath(sourceConfig.root);

  if (realSourcePath?.startsWith(realSourceRoot) !== true) {
    const boomError = Boom.notFound('Source file not found');
    boomError.output.payload.messages = ['Source file not found'];
    throw boomError;
  }

  if (realDestPath?.startsWith(realSourceRoot) !== true) {
    const boomError = Boom.badRequest('Need destination path');
    boomError.output.payload.messages = ['Need destination path'];
    throw boomError;
  }

  // Check if source exists
  const sourceStats = await fs.stat(realSourcePath).catch(() => null);
  if (sourceStats == null) {
    const boomError = Boom.notFound('Not file');
    boomError.output.payload.messages = ['Not file'];
    throw boomError;
  }

  // Build final destination path with original filename
  const fileName = path.basename(realSourcePath);
  const finalDestPath = path.join(realDestPath, fileName);

  // Move file/folder
  try {
    await fs.rename(realSourcePath, finalDestPath);
  } catch (error) {
    const boomError = Boom.internal('Move failed!');
    boomError.output.payload.messages = [
      `Move failed! ${error instanceof Error ? error.message : 'Unknown error'}`
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
