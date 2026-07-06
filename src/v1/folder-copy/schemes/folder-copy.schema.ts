import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for folder copy
 */
export const FolderCopyQuerySchema = z
  .object({
    action: z.literal('folderCopy').optional().openapi({
      description: 'Action name',
      example: 'folderCopy'
    }),
    source: z.string().optional().openapi({
      description: 'Source name (defaults to "files")',
      example: 'test'
    }),
    from: z.string().openapi({
      description: 'Source folder path relative to source root',
      example: '/folder-name'
    }),
    path: z.string().optional().openapi({
      description: 'Destination directory path (default: "/")',
      example: '/new-location/',
      default: '/'
    })
  })
  .openapi('FolderCopyQuery');

export type FolderCopyQueryParams = z.infer<typeof FolderCopyQuerySchema>;

/**
 * Successful folder copy response
 */
export const FolderCopySuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220)
    })
  })
  .openapi('FolderCopySuccessResponse');
