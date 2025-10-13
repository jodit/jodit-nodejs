import type { Request, Response } from 'express';
import type { AppConfig } from '../../types';
import Boom from '@hapi/boom';
import { GetLocalFileByUrlQuerySchema } from '../../schemas';
import path from 'path';
import fs from 'fs/promises';
import { URL } from 'url';

export async function getLocalFileByUrlHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config as AppConfig;

  // Validate query params
  const queryValidation = GetLocalFileByUrlQuerySchema.safeParse(req.params_data);
  if (queryValidation.success === false) {
    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  const query = queryValidation.data;

  if (query.url === '') {
    const boomError = Boom.badRequest('Need full url');
    boomError.output.payload.messages = ['Need full url'];
    throw boomError;
  }

  // Parse URL
  let urlParts: URL;
  try {
    urlParts = new URL(query.url);
  } catch {
    const boomError = Boom.badRequest('Empty url');
    boomError.output.payload.messages = ['Empty url'];
    throw boomError;
  }

  if (!urlParts.pathname) {
    const boomError = Boom.badRequest('Empty url');
    boomError.output.payload.messages = ['Empty url'];
    throw boomError;
  }

  // Try to resolve file in each source
  for (const [sourceName, sourceConfig] of Object.entries(config.sources)) {
    // Parse source baseurl
    let baseUrlParts: URL;
    try {
      baseUrlParts = new URL(sourceConfig.baseurl);
    } catch {
      continue; // Skip invalid baseurl
    }

    // Extract path relative to baseurl
    let relativePath = urlParts.pathname;
    if (baseUrlParts.pathname) {
      const basePath = baseUrlParts.pathname.replace(/\/$/, '');
      if (relativePath.startsWith(basePath)) {
        relativePath = relativePath.substring(basePath.length);
      } else {
        continue; // URL doesn't match this source
      }
    }

    // Build full file path
    const fullPath = path.join(sourceConfig.root, relativePath);

    // Check if file exists and is within source root
    try {
      const realPath = await fs.realpath(fullPath);
      const realRoot = await fs.realpath(sourceConfig.root);

      if (!realPath.startsWith(realRoot)) {
        continue; // File is outside source root
      }

      const stats = await fs.stat(realPath);
      if (!stats.isFile()) {
        continue; // Not a file
      }

      // File found - return info
      const fileName = path.basename(realPath);
      const dirPath = path.dirname(realPath);
      const relativeDir = dirPath.replace(realRoot, '') || '/';

      res.json({
        success: true,
        data: {
          code: 220,
          path: relativeDir,
          name: fileName,
          source: sourceName
        }
      });
      return;
    } catch {
      continue; // File doesn't exist in this source
    }
  }

  // File not found in any source
  const boomError = Boom.badRequest(
    'File does not exist or is above the root of the connector'
  );
  boomError.output.payload.messages = [
    'File does not exist or is above the root of the connector'
  ];
  throw boomError;
}
