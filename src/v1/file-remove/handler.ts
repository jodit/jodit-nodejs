import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FileRemoveQuerySchema } from '../../schemas';

export async function fileRemoveHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate query params
  const queryValidation = FileRemoveQuerySchema.safeParse(req.context.data);
  if (queryValidation.success === false) {
    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }
  res.send({ success: false });
}
