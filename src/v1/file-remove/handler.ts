import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FileRemoveQuerySchema } from '../../schemas';

export async function fileRemoveHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  // Validate query params
  const queryValidation = FileRemoveQuerySchema.safeParse(req.context.data);
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

  // Get filename from request
  const fileName = req.context.getField<string>('name', '');
  if (!fileName) {
    throw Boom.badRequest('Name parameter is required');
  }

  // Remove file through source interface
  await source.fileRemove(fileName, req.context.path);

  res.json({
    success: true,
    data: {
      code: 220
    }
  });
}
