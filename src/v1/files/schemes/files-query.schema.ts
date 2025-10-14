import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Mods schema for files query
export const FilesModsSchema = z.object({
  withFolders: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform(val => val === true || val === 'true'),
  sortBy: z
    .enum(['name-asc', 'name-desc', 'changed-asc', 'changed-desc'])
    .optional()
    .describe('Sort order'),
  limit: z
    .union([z.number(), z.string()])
    .optional()
    .transform(val => (typeof val === 'string' ? parseInt(val, 10) : val)),
  offset: z
    .union([z.number(), z.string()])
    .optional()
    .transform(val => (typeof val === 'string' ? parseInt(val, 10) : val)),
  onlyImages: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform(val => val === true || val === 'true'),
  foldersPosition: z.enum(['top', 'bottom']).optional()
});

// Files action query schema
export const FilesQuerySchema = z
  .object({
    action: z
      .literal('files')
      .optional()
      .describe('Action type')
      .optional()
      .openapi({
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
      .union([z.string(), FilesModsSchema])
      .optional()
      .describe('Modifiers (e.g., "withFolders" or object with filters)')
      .openapi({
        description: 'Modifiers (e.g., "withFolders")',
        example: 'withFolders'
      })
  })
  .openapi('FilesQuery');

export type FilesQueryParams = z.infer<typeof FilesQuerySchema>;
export type FilesModsParams = z.infer<typeof FilesModsSchema>;
