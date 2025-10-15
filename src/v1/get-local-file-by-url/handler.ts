import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { GetLocalFileByUrlQuerySchema } from '../../schemas';

export async function getLocalFileByUrlHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  // Validate query params
  const queryValidation = GetLocalFileByUrlQuerySchema.safeParse(
    req.context.data
  );
  if (queryValidation.success === false) {
    // Check if the error is about invalid URL
    const hasUrlError = queryValidation.error.issues.some(
      issue => issue.path.length > 0 && issue.path[0] === 'url'
    );

    if (hasUrlError) {
      const boomError = Boom.badRequest('Empty url');
      boomError.output.payload.messages = ['Empty url'];
      throw boomError;
    }

    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  const query = queryValidation.data;

  // Validate URL
  if (!query.url || query.url.trim() === '') {
    const boomError = Boom.badRequest('Empty url');
    boomError.output.payload.messages = ['Empty url'];
    throw boomError;
  }

  // Try to parse URL to ensure it's valid
  try {
    new URL(query.url);
  } catch {
    const boomError = Boom.badRequest('Empty url');
    boomError.output.payload.messages = ['Empty url'];
    throw boomError;
  }

  // Get all sources and try to resolve the file
  let sources;
  try {
    sources = await config.getSources({ action: req.context.action });
  } catch {
    // If getSources throws an error, convert it to 400
    const boomError = Boom.badRequest('File does not exist');
    boomError.output.payload.messages = ['File does not exist'];
    throw boomError;
  }

  let resolvedFile = null;
  for (const source of sources) {
    try {
      resolvedFile = await source.resolveFileByUrl(query.url);
      if (resolvedFile) {
        break;
      }
    } catch {
      // If resolveFileByUrl throws an error, continue to next source
      continue;
    }
  }

  if (!resolvedFile) {
    const boomError = Boom.badRequest('File does not exist');
    boomError.output.payload.messages = ['File does not exist'];
    throw boomError;
  }

  res.json({
    success: true,
    data: {
      code: 220,
      path: resolvedFile.path,
      name: resolvedFile.name,
      source: resolvedFile.source
    }
  });
}
