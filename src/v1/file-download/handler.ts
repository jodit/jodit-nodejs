import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FileDownloadQuerySchema } from './schemes/file-download.schema';

export async function fileDownloadHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  // Validate query parameters
  const queryValidation = FileDownloadQuerySchema.safeParse(req.context.data);
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

  // Get name parameter (file name to download)
  const name = req.context.getField<string>('name', '');

  if (!name) {
    throw Boom.badRequest('Name parameter is required');
  }

  // Download file through source interface
  const file = await source.fileDownload(name, req.context.path);

  // Send file to client
  await file.send(res);
}
