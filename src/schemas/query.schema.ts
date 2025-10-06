import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Base action query schema
export const BaseActionQuerySchema = z
  .object({
    action: z
      .string({ message: 'Action parameter is required' })
      .min(1, 'Action parameter is required')
      .describe('Action to perform')
      .openapi({
        description: 'Action to perform',
        example: 'files'
      })
  })
  .openapi('BaseActionQuery');

export type BaseActionQueryParams = z.infer<typeof BaseActionQuerySchema>;

// Passthrough version that allows unknown keys
export const BaseActionQueryPassthroughSchema = BaseActionQuerySchema.loose();

// Files action query schema
export const FilesQuerySchema = z
  .object({
    action: z.literal('files').describe('Action type').openapi({
      description: 'Action type',
      example: 'files'
    }),
    source: z.string().optional().describe('Source name').openapi({
      description: 'Source name',
      example: 'test'
    }),
    path: z.string().optional().describe('Path within source').openapi({
      description: 'Path within source',
      example: '/',
      default: '/'
    }),
    mods: z
      .string()
      .optional()
      .describe('Modifiers (e.g., "withFolders")')
      .openapi({
        description: 'Modifiers (e.g., "withFolders")',
        example: 'withFolders'
      })
  })
  .openapi('FilesQuery');

export type FilesQueryParams = z.infer<typeof FilesQuerySchema>;
