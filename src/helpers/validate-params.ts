import Boom from '@hapi/boom';
import type { ZodSchema } from 'zod';

/**
 * Validates request parameters using a Zod schema.
 * Throws a Boom badRequest error if validation fails.
 *
 * @param params - The parameters to validate (from req.params_data)
 * @param schema - The Zod schema to validate against
 * @returns The validated and parsed data
 * @throws {Boom.badRequest} If validation fails
 */
export function validateParams<T>(
  params: Record<string, unknown>,
  schema: ZodSchema<T>
): T {
  const validation = schema.safeParse(params);

  if (!validation.success) {
    const messages = validation.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = messages;
    throw boomError;
  }

  return validation.data;
}
