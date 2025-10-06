import type { Request, Response } from 'express';
import type { FilesActionResponse, SourceData, AppConfig } from '../types';
import Boom from '@hapi/boom';
import { getFileItems } from '../helpers/file-system';
import { FilesQuerySchema } from '../schemas';
import path from 'path';

export async function filesHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config as AppConfig;

  // Validate files-specific query params
  const filesValidation = FilesQuerySchema.safeParse(req.query);
  if (!filesValidation.success) {
    const errors = filesValidation.error.issues.map((err) => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  const query = filesValidation.data;
  const sourceName = query.source;
  const sourcePath = query.path ?? '/';
  const withFolders = query.mods?.includes('withFolders') ?? false;

  const sources: SourceData[] = [];

  // If source is specified, use only that source
  if (
    typeof sourceName === 'string' &&
    sourceName.length > 0 &&
    config.sources[sourceName] === undefined
  ) {
    const boomError = Boom.notFound('Source not found');
    boomError.output.payload.messages = ['Source not found'];
    throw boomError;
  }

  const sourcesToProcess =
    typeof sourceName === 'string' && sourceName.length > 0
      ? { [sourceName]: config.sources[sourceName] }
      : config.sources;

  for (const [name, sourceConfig] of Object.entries(sourcesToProcess)) {
    if (sourceConfig === null || sourceConfig === undefined) continue;

    const fullPath = path.join(sourceConfig.root, sourcePath);
    const files = await getFileItems(fullPath, withFolders, config.imageExtensions);

    const sourceData: SourceData = {
      name,
      title: sourceConfig.title,
      baseurl: sourceConfig.baseurl,
      path: sourcePath,
      files
    };

    sources.push(sourceData);
  }

  const response: FilesActionResponse = {
    code: 220,
    sources
  };

  res.json({
    success: true,
    data: response
  });
}
