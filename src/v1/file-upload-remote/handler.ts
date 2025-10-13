import type { Request, Response } from 'express';
import type { AppConfig } from '../../types';
import Boom from '@hapi/boom';
import { FileUploadRemoteQuerySchema } from '../../schemas';
import path from 'path';
import fs from 'fs/promises';
import { URL } from 'url';
import { makeSafeFilename, validateUploadedFile } from '../../helpers/file-upload';
import { isImageFile } from '../../helpers/file-system';

export async function fileUploadRemoteHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config as AppConfig;

  // Validate query params
  const queryValidation = FileUploadRemoteQuerySchema.safeParse(req.params_data);
  if (queryValidation.success === false) {
    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  const query = queryValidation.data;

  if (query.url === '') {
    const boomError = Boom.badRequest('Need url parameter');
    boomError.output.payload.messages = ['Need url parameter'];
    throw boomError;
  }

  // Parse and validate URL
  let urlParts: URL;
  try {
    urlParts = new URL(query.url);
  } catch {
    const boomError = Boom.badRequest('Invalid URL');
    boomError.output.payload.messages = ['Invalid URL'];
    throw boomError;
  }

  if (!urlParts.host || !urlParts.pathname) {
    const boomError = Boom.badRequest('Invalid URL');
    boomError.output.payload.messages = ['Invalid URL'];
    throw boomError;
  }

  // Extract filename from URL
  const urlFilename = path.basename(urlParts.pathname);
  const safeFilename = makeSafeFilename(urlFilename);

  if (!safeFilename) {
    const boomError = Boom.badRequest('Not valid URL');
    boomError.output.payload.messages = ['Not valid URL'];
    throw boomError;
  }

  const sourcePath = query.path ?? '/';
  const targetDir = path.join(req.sourceConfig.root, sourcePath);

  // Ensure target directory exists
  try {
    await fs.access(targetDir);
  } catch {
    const boomError = Boom.badRequest('Target directory does not exist');
    boomError.output.payload.messages = ['Target directory does not exist'];
    throw boomError;
  }

  const finalPath = path.join(targetDir, safeFilename);

  // Download file from URL
  let fileContent: Buffer;
  try {
    const response = await fetch(query.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    fileContent = Buffer.from(arrayBuffer);
  } catch (error) {
    const boomError = Boom.badRequest('File was not loaded');
    boomError.output.payload.messages = [
      `File was not loaded: ${error instanceof Error ? error.message : 'Unknown error'}`
    ];
    throw boomError;
  }

  // Save to temporary file for validation
  const tmpPath = `${finalPath}.tmp`;
  try {
    await fs.writeFile(tmpPath, fileContent);

    // Validate file
    const validation = await validateUploadedFile(
      tmpPath,
      safeFilename,
      config
    );

    if (!validation.valid) {
      await fs.unlink(tmpPath);
      const boomError = Boom.forbidden(
        validation.reason ?? 'File validation failed'
      );
      boomError.output.payload.messages = [
        validation.reason ?? 'File validation failed'
      ];
      throw boomError;
    }

    // Move to final location
    await fs.rename(tmpPath, finalPath);
  } catch (error) {
    // Clean up temp file if exists
    await fs.unlink(tmpPath).catch(() => {});

    if (Boom.isBoom(error)) {
      throw error;
    }

    const boomError = Boom.internal('Failed to save file');
    boomError.output.payload.messages = [
      `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`
    ];
    throw boomError;
  }

  const isImage = isImageFile(safeFilename, config.imageExtensions);

  res.json({
    success: true,
    data: {
      code: 220,
      baseurl: req.sourceConfig.baseurl,
      newfilename: safeFilename,
      isImage
    }
  });
}
