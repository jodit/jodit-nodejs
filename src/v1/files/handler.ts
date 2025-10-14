import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FilesQuerySchema } from '../../schemas';
import { ISourceItem } from '../../types/abstract-file-system';

export async function filesHandler(req: Request, res: Response): Promise<void> {
  const config = req.app.locals.config;

  // Validate files-specific query params
  const filesValidation = FilesQuerySchema.safeParse(req.context.data);
  if (!filesValidation.success) {
    throw Boom.badRequest(
      'Validation failed ' +
        filesValidation.error.issues.map(err => err.message)
    );
  }

  const response: Promise<ISourceItem>[] = [];

  const sourcesList = await config.getSources({
    source: req.context.source,
    action: req.context.action
  });

  for (const source of sourcesList) {
    response.push(
      source.items(req.context.path, {
        withFolders: req.context.getField('mods/withFolders', false),
        onlyImages: req.context.getField('mods/onlyImages', false),
        offset: req.context.getField('mods/offset', 0),
        limit: req.context.getField('mods/limit', config.params.countInChunk),
        sortBy: req.context.getField(
          'mods/sortBy',
          config.params.defaultSortBy
        ),
        foldersPosition: req.context.getField('mods/foldersPosition', 'default')
      })
    );
  }

  res.json({
    success: true,
    data: {
      code: 220,
      sources: await Promise.all(response)
    }
  });
}
