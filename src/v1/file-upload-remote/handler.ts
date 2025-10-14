import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FileUploadRemoteQuerySchema } from '../../schemas';

export async function fileUploadRemoteHandler(
  req: Request,
  res: Response
): Promise<void> {
  // const config = req.app.locals.config;

  // Validate query params
  const queryValidation = FileUploadRemoteQuerySchema.safeParse(req.context.data);
  if (queryValidation.success === false) {
    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  // const query = queryValidation.data;

  res.send({ success: false });
}
