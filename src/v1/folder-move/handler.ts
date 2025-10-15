import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FolderMoveQuerySchema } from '../../schemas';

/**
 * Handler for moving a folder to a different location
 * GET /?action=folderMove&source=test&from=/folder-name&path=/new-location/
 */
export async function folderMoveHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  // Validate query parameters
  const queryValidation = FolderMoveQuerySchema.safeParse(req.context.data);
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

  // Get from parameter (path to folder to move)
  const from = req.context.getField<string>('from', '');

  if (!from) {
    throw Boom.badRequest('From parameter is required');
  }

  // Move folder through source interface
  await source.movePath(from, req.context.path);

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
