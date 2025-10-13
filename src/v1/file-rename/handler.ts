import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FileRenameQuerySchema } from '../../schemas';
import path from 'path';
import fs from 'fs/promises';
import { makeSafeFilename } from '../../helpers/file-upload';

export async function fileRenameHandler(
  req: Request,
  res: Response
): Promise<void> {

  // Validate query params
  const queryValidation = FileRenameQuerySchema.safeParse(req.params_data);
  if (queryValidation.success === false) {
    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  const query = queryValidation.data;

  const sourcePath = query.path ?? '/';

  // Make names safe
  const safeName = makeSafeFilename(query.name);
  const safeNewName = makeSafeFilename(query.newname);

  // Build full paths
  const fromPath = path.join(req.sourceConfig.root, sourcePath, safeName);
  let toPath = path.join(req.sourceConfig.root, sourcePath, safeNewName);

  // Check if source file/folder exists
  const sourceStats = await fs.stat(fromPath).catch(() => null);
  if (sourceStats == null) {
    const boomError = Boom.notFound('Path not exists');
    boomError.output.payload.messages = ['Path not exists'];
    throw boomError;
  }

  // For files, preserve extension if new name doesn't have one
  if (sourceStats.isFile()) {
    const oldExt = path.extname(fromPath).toLowerCase();
    const newExt = path.extname(toPath).toLowerCase();

    if (newExt !== oldExt) {
      toPath += oldExt;
    }
  }

  // Check if destination already exists
  const destExists = await fs
    .access(toPath)
    .then(() => true)
    .catch(() => false);
  if (destExists) {
    const boomError = Boom.badRequest(
      `New ${path.basename(toPath)} already exists`
    );
    boomError.output.payload.messages = [
      `New ${path.basename(toPath)} already exists`
    ];
    throw boomError;
  }

  // Rename file/folder
  try {
    await fs.rename(fromPath, toPath);
  } catch (error) {
    const boomError = Boom.internal('Rename failed!');
    boomError.output.payload.messages = [
      `Rename failed! ${error instanceof Error ? error.message : 'Unknown error'}`
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
