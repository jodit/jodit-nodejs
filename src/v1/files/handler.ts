import path from 'node:path';
import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import type { FilesActionResponse, SourceData, AppConfig, FileItem } from '../../types';
import { getFileItems } from '../../helpers/file-system';
import { FilesQuerySchema, FilesModsSchema } from '../../schemas';

export async function filesHandler(req: Request, res: Response): Promise<void> {
  const config = req.app.locals.config as AppConfig;

  // Support both GET (query) and POST (body) requests
  const params = req.method === 'POST' ? req.body : req.query;

  // Validate files-specific query params
  const filesValidation = FilesQuerySchema.safeParse(params);
  if (!filesValidation.success) {
    const errors = filesValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  const query = filesValidation.data;
  const sourceName = query.source;
  const sourcePath = query.path ?? '/';

  // Parse mods parameter - can be string or object
  let mods: Partial<ReturnType<typeof FilesModsSchema.parse>> = {};
  if (typeof query.mods === 'string') {
    // Legacy string format: "withFolders"
    mods = { withFolders: query.mods.includes('withFolders') };
  } else if (typeof query.mods === 'object') {
    // Object format: { sortBy: 'name-asc', limit: 10, ... }
    const modsValidation = FilesModsSchema.safeParse(query.mods);
    if (modsValidation.success) {
      mods = modsValidation.data;
    }
  }

  const withFolders = mods.withFolders ?? false;

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
    let files = await getFileItems(
      fullPath,
      sourceConfig.root,
      withFolders,
      config.imageExtensions,
      config.createThumb,
      config.thumbFolderName,
      config.thumbSize,
      config.quality,
      config.safeThumbsCountInOneTime
    );

    // Apply onlyImages filter
    if (mods.onlyImages === true) {
      files = files.filter((file: FileItem) => file.isImage === true);
    }

    // Apply sorting
    if (mods.sortBy != null) {
      const [field, order] = mods.sortBy.split('-') as [string, 'asc' | 'desc'];
      files.sort((a: FileItem, b: FileItem) => {
        let aValue: string | number;
        let bValue: string | number;

        if (field === 'name') {
          aValue = a.file.toLowerCase();
          bValue = b.file.toLowerCase();
        } else if (field === 'changed') {
          aValue = a.changed ?? 0;
          bValue = b.changed ?? 0;
        } else {
          return 0;
        }

        if (order === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
    }

    // Apply foldersPosition
    if (mods.foldersPosition) {
      const folders = files.filter((f: FileItem) => f.type === 'folder');
      const nonFolders = files.filter((f: FileItem) => f.type !== 'folder');

      if (mods.foldersPosition === 'top') {
        files = [...folders, ...nonFolders];
      } else {
        files = [...nonFolders, ...folders];
      }
    }

    // Apply offset and limit
    const offset = mods.offset ?? 0;
    const limit = mods.limit;
    if (offset > 0 || limit !== undefined) {
      const end = limit !== undefined ? offset + limit : undefined;
      files = files.slice(offset, end);
    }

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
