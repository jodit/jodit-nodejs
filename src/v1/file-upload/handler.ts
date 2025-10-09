import type { Request, Response } from 'express';
import type { AppConfig } from '../../types';
import Boom from '@hapi/boom';
import { FileUploadQuerySchema } from '../../schemas';
import path from 'path';
import fs from 'fs/promises';
import {
  makeSafeFilename,
  validateUploadedFile,
  generateUniqueFilename,
  getRelativePath
} from '../../helpers/file-upload';
import { isImageFile } from '../../helpers/file-system';

export async function fileUploadHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config as AppConfig;

  // For POST requests, params can come from query or body
  const params = { ...req.query, ...req.body };

  // Validate params
  const queryValidation = FileUploadQuerySchema.safeParse(params);
  if (queryValidation.success === false) {
    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  const query = queryValidation.data;
  const sourceName = query.source ?? config.defaultFilesKey;
  const sourcePath = query.path ?? '/';

  // Check if source exists
  if (config.sources[sourceName] === undefined) {
    const boomError = Boom.notFound('Source not found');
    boomError.output.payload.messages = ['Source not found'];
    throw boomError;
  }

  const sourceConfig = config.sources[sourceName];

  // Check if files were uploaded
  if (
    req.files === undefined ||
    req.files === null ||
    !Array.isArray(req.files)
  ) {
    const boomError = Boom.badRequest('No files have been uploaded');
    boomError.output.payload.messages = ['No files have been uploaded'];
    throw boomError;
  }

  /* eslint-disable-next-line no-undef */
  const uploadedFiles = req.files as Express.Multer.File[];

  if (uploadedFiles.length === 0) {
    const boomError = Boom.badRequest('No files have been uploaded');
    boomError.output.payload.messages = ['No files have been uploaded'];
    throw boomError;
  }

  const targetDir = path.join(sourceConfig.root, sourcePath);

  // Ensure target directory exists
  try {
    await fs.access(targetDir);
  } catch {
    const boomError = Boom.badRequest('Target directory does not exist');
    boomError.output.payload.messages = ['Target directory does not exist'];
    throw boomError;
  }

  const files: string[] = [];
  const isImages: boolean[] = [];
  const messages: string[] = [];

  // Process each uploaded file
  for (const file of uploadedFiles) {
    const safeFilename = makeSafeFilename(file.originalname);

    // Validate file
    const validation = await validateUploadedFile(
      file.path,
      safeFilename,
      config
    );

    if (!validation.valid) {
      // Remove temp file
      await fs.unlink(file.path);

      const boomError = Boom.forbidden(
        validation.reason ?? 'File validation failed'
      );
      boomError.output.payload.messages = [
        validation.reason ?? 'File validation failed'
      ];
      throw boomError;
    }

    // Generate unique filename if needed
    const targetPath = path.join(targetDir, safeFilename);
    const finalFilename = await generateUniqueFilename(
      targetPath,
      safeFilename,
      config.saveSameFileNameStrategy
    );
    const finalPath = path.join(targetDir, finalFilename);

    // Move file to target location
    try {
      await fs.rename(file.path, finalPath);
    } catch {
      // If rename fails, try copy + delete
      try {
        await fs.copyFile(file.path, finalPath);
        await fs.unlink(file.path);
      } catch {
        const boomError = Boom.internal('Failed to save uploaded file');
        boomError.output.payload.messages = ['Failed to save uploaded file'];
        throw boomError;
      }
    }

    const relativePath = getRelativePath(finalPath, sourceConfig.root);
    const isImage = isImageFile(finalFilename, config.imageExtensions);

    files.push(relativePath);
    isImages.push(isImage);
    messages.push(`File ${finalFilename} was uploaded`);
  }

  res.json({
    success: true,
    data: {
      code: 220,
      baseurl: sourceConfig.baseurl,
      files,
      isImages,
      messages
    }
  });
}
