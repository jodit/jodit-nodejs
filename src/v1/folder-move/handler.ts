import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FolderMoveQuerySchema } from '../../schemas';

/**
 * Handler for moving a folder to a different location
 * GET /?action=folderMove&source=test&from=/folder-name&path=/new-location/
 */
export async function folderMoveHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate query parameters
  const queryValidation = FolderMoveQuerySchema.safeParse(req.context.data);
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
