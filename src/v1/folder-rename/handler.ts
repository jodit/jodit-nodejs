import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FolderRenameQuerySchema } from '../../schemas';

export async function folderRenameHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  // Validate query parameters
  const queryValidation = FolderRenameQuerySchema.safeParse(req.context.data);
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

  // Get name and newname from request
  const name = req.context.getField<string>('name', '');
  const newname = req.context.getField<string>('newname', '');

  if (!name) {
    throw Boom.badRequest('Name parameter is required');
  }

  if (!newname) {
    throw Boom.badRequest('Newname parameter is required');
  }

  // Rename folder through source interface
  await source.renamePath(name, newname, req.context.path, 'folder');

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
