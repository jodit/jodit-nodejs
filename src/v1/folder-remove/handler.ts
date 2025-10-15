import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FolderRemoveQuerySchema } from '../../schemas';

/**
 * Handler for removing a folder
 * GET /?action=folderRemove&source=test&name=foldername&path=/
 */
export async function folderRemoveHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  // Validate query parameters
  const queryValidation = FolderRemoveQuerySchema.safeParse(req.context.data);
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

  // Get folder name from request
  const name = req.context.getField<string>('name', '');

  if (!name) {
    throw Boom.badRequest('Name parameter is required');
  }

  // Remove folder through source interface
  await source.folderRemove(name, req.context.path);

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
