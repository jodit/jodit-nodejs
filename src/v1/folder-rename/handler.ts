import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FolderRenameQuerySchema } from '../../schemas';

export async function folderRenameHandler(
  req: Request,
  res: Response
): Promise<void> {
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

  res.json({
    success: false
  });
}
