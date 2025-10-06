import type { Request, Response } from 'express';
import type { AppConfig } from '../types';
import Boom from '@hapi/boom';
import { FileDownloadQuerySchema } from '../schemas';
import path from 'path';
import fs from 'fs/promises';

export async function fileDownloadHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config as AppConfig;

  // Validate query params
  const queryValidation = FileDownloadQuerySchema.safeParse(req.query);
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

  // Read file
  const fileContent = await fs.readFile(realTargetPath).catch(() => null);
  if (fileContent == null) {
    const boomError = Boom.internal('Download failed!');
    boomError.output.payload.messages = ['Download failed!'];
    throw boomError;
  }

  // Send file with proper headers
  res.setHeader('Content-Description', 'File Transfer');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${path.basename(realTargetPath)}"`
  );
  res.setHeader('Content-Transfer-Encoding', 'binary');
  res.setHeader('Expires', '0');
  res.setHeader('Cache-Control', 'must-revalidate, post-check=0, pre-check=0');
  res.setHeader('Pragma', 'public');
  res.setHeader('Content-Length', stats.size.toString());

  res.send(fileContent);
}
