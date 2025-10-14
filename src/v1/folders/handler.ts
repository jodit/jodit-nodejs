import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FoldersQuerySchema } from '../../schemas';
import type { ISourceFolders } from '../../types/abstract-file-system';

export async function foldersHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate query parameters
  const queryValidation = FoldersQuerySchema.safeParse(req.context.data);
  if (queryValidation.success === false) {
    const messages = queryValidation.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = messages;
    throw boomError;
  }

  const config = req.app.locals.config;
  const sourcesList = await config.getSources({
    source: req.context.source,
    action: req.context.action
  });

  const response: Promise<ISourceFolders>[] = [];

  for (const source of sourcesList) {
    response.push(
      source.folders(req.context.path, {
        dots: req.context.getField<boolean | undefined>('dots', undefined)
      })
    );
  }

  res.json({
    success: true,
    data: {
      sources: await Promise.all(response),
      code: 220
    }
  });
}
