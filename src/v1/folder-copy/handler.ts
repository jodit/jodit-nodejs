import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FolderCopyQuerySchema } from '../../schemas';

/**
 * Handler for copying a folder (recursively) to a different location
 * GET /?action=folderCopy&source=test&from=/folder-name&path=/new-location/
 */
export async function folderCopyHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  const queryValidation = FolderCopyQuerySchema.safeParse(req.context.data);
  if (queryValidation.success === false) {
    const messages = queryValidation.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = messages;
    throw boomError;
  }

  // Get source
  const [source] = await config.getSources({
    source: req.context.source,
    action: req.context.action
  });

  // Get from parameter (path to folder to copy)
  const from = req.context.getField<string>('from', '');

  if (!from) {
    throw Boom.badRequest('From parameter is required');
  }

  // Copy folder through source interface
  await source.copyPath(from, req.context.path);

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
