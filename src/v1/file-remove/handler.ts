import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FileRemoveQuerySchema } from '../../schemas';
import path from 'path';
import fs from 'fs/promises';

export async function fileRemoveHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate query params
  const queryValidation = FileRemoveQuerySchema.safeParse(req.params_data);
  if (queryValidation.success === false) {
    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  const query = queryValidation.data;

  const sourcePath = query.path ?? '/';

  // Validate and get file path
  const targetPath = path.join(req.sourceConfig.root, sourcePath, query.name);

  // Security check: ensure file is within source root
  const realTargetPath = await fs.realpath(targetPath).catch(() => null);
  const realSourceRoot = await fs.realpath(req.sourceConfig.root);

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
