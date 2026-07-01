import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { ImageLoadQuerySchema } from '../../schemas';

/**
 * Return an image as a base64 data URL through the CORS-enabled JSON API, so a
 * browser on a different origin (dev server, image editor) can read a file that
 * the raw file host would otherwise block via CORS.
 */
export async function imageLoadHandler(
  req: Request,
  res: Response
): Promise<void> {
  // POST only: a GET could otherwise be embedded (<img>, link, cache, logs) and
  // abuse the connector as an open proxy for reading files.
  if (req.method !== 'POST') {
    throw Boom.methodNotAllowed('imageLoad requires a POST request');
  }

  const config = req.app.locals.config;

  const queryValidation = ImageLoadQuerySchema.safeParse(req.context.data);
  if (queryValidation.success === false) {
    const messages = queryValidation.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = messages;
    throw boomError;
  }

  const [source] = await config.getSources({
    source: req.context.source,
    action: req.context.action
  });

  const name = req.context.getField<string>('name', '');

  if (!name) {
    throw Boom.badRequest('Name parameter is required');
  }

  const result = await source.loadImage(name, req.context.path);

  res.json({
    success: true,
    data: {
      code: 220,
      content: result.dataUrl,
      name: result.name
    }
  });
}
