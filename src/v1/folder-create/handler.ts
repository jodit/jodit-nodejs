import { Request, Response } from 'express';
import Boom from '@hapi/boom';

/**
 * Handler for creating a new folder
 * GET /?action=folderCreate&source=test&name=newfolder&path=/
 */
export async function folderCreateHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

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

  // Create folder through source interface
  await source.makeFolder(name, req.context.path);

  res.json({
    success: true,
    data: {
      code: 220,
      messages: ['Directory successfully created']
    }
  });
}
