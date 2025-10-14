import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FileMoveQuerySchema } from '../../schemas';

export async function fileMoveHandler(
  req: Request,
  res: Response
): Promise<void> {
  const queryValidation = FileMoveQuerySchema.safeParse(req.context.data);
  if (queryValidation.success === false) {
    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  res.json({
    success: false
  });
}
