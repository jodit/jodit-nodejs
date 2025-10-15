import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FileRenameQuerySchema } from '../../schemas';

export async function fileRenameHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  // Validate query params
  const queryValidation = FileRenameQuerySchema.safeParse(req.context.data);
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

  // Get name and newname from request
  const name = req.context.getField<string>('name', '');
  const newname = req.context.getField<string>('newname', '');

  if (!name) {
    throw Boom.badRequest('Name parameter is required');
  }

  if (!newname) {
    throw Boom.badRequest('Newname parameter is required');
  }

  // Rename file through source interface
  await source.renamePath(name, newname, req.context.path, 'file');

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
