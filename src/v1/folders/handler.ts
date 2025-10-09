import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import fs from 'fs/promises';
import path from 'path';
import { FoldersQuerySchema } from '../../schemas';
import { logger } from '../../helpers/logger';
import type { AppConfig } from '../../types';

interface SourceFolders {
  name: string;
  title: string;
  baseurl: string;
  path: string;
  folders: string[];
}

/**
 * Handler for getting list of folders
 * GET /?action=folders&source=test&path=/
 */
export async function foldersHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config: AppConfig = req.app.locals.config;

  // Validate query parameters
  const queryValidation = FoldersQuerySchema.safeParse(req.query);
  if (queryValidation.success === false) {
    const messages = queryValidation.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = messages;
    throw boomError;
  }

  const query = queryValidation.data;
  const sources: SourceFolders[] = [];

  logger.debug('Getting folders list');

  // Helper function to check if a name should be excluded
  const isExcluded = (name: string): boolean => {
    if (name === '.' || name === '..') return true;
    if (config.createThumb && name === (config.thumbFolderName || '_thumbs'))
      return true;
    if (config.excludeDirectoryNames?.includes(name)) return true;
    return false;
  };

  // Get folders for all sources if no specific source is specified
  const sourcesToProcess =
    query.source != null ? [query.source] : Object.keys(config.sources);

  for (const sourceName of sourcesToProcess) {
    const sourceConfig = config.sources?.[sourceName];
    if (sourceConfig === undefined) {
      continue; // Skip non-existent sources
    }

    const requestPath = query.path ?? '/';
    const targetPath = path.join(sourceConfig.root, requestPath);

    // Security check: ensure target path is within source root
    const realTargetPath = await fs.realpath(targetPath).catch(() => null);
    const realSourceRoot = await fs.realpath(sourceConfig.root);

    if (realTargetPath?.startsWith(realSourceRoot) !== true) {
      continue; // Skip invalid paths
    }

    // Check if path exists and is a directory
    const stats = await fs.stat(realTargetPath).catch(() => null);
    if (stats?.isDirectory() !== true) {
      continue; // Skip non-directories
    }

    // Read directory contents
    const entries = await fs.readdir(realTargetPath, { withFileTypes: true });
    const folders: string[] = [];

    // Add parent directory navigation if not at root
    if (query.dots !== false && realTargetPath !== realSourceRoot) {
      folders.push('..');
    }

    // Filter and collect folder names
    for (const entry of entries) {
      if (entry.isDirectory() && !isExcluded(entry.name)) {
        folders.push(entry.name);
      }
    }

    // Calculate relative path
    const relativePath = requestPath === '/' ? '/' : requestPath;

    sources.push({
      name: sourceName,
      title: sourceConfig.title || sourceName,
      baseurl: sourceConfig.baseurl,
      path: relativePath,
      folders
    });
  }

  res.json({
    success: true,
    data: {
      code: 220,
      sources
    }
  });
}
