import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FileCopyQuerySchema } from '../../schemas';

/**
 * Handler for copying a file to a different location
 * GET /?action=fileCopy&source=test&from=/file.txt&path=/subfolder
 */
export async function fileCopyHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  const queryValidation = FileCopyQuerySchema.safeParse(req.context.data);
  if (queryValidation.success === false) {
    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  // Get source
  const [source] = await config.getSources({
    source: req.context.source,
    action: req.context.action
  });

  // Get from parameter (path to file/folder to copy)
  const from = req.context.getField<string>('from', '');

  if (!from) {
    throw Boom.badRequest('From parameter is required');
  }

  // Copy file/folder through source interface
  await source.copyPath(from, req.context.path);

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
