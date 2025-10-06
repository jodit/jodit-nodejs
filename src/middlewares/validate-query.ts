import type { Request, Response, NextFunction } from 'express';
import type { ZodType, ZodError } from 'zod';
import Boom from '@hapi/boom';
import { logger } from '../helpers/logger';

export function validateQuery(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const zodError = result.error as ZodError;
      const errors = zodError.issues.map((err) => err.message);
      logger.debug(`Validation error: ${errors.join(', ')}`);

      const boomError = Boom.badRequest('Validation failed');
      boomError.output.payload.messages = errors;
      next(boomError);
      return;
    }

    next();
  };
}
