import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for folder removal
 */
export const FolderRemoveQuerySchema = z
  .object({
    action: z.literal('folderRemove').optional().openapi({
      description: 'Action name',
      example: 'folderRemove'
    }),
    source: z.string().optional().openapi({
      description: 'Source name (defaults to "files")',
      example: 'test'
    }),
    path: z.string().optional().openapi({
      description: 'Parent directory path within source (default: "/")',
      example: '/',
      default: '/'
    }),
    name: z.string().openapi({
      description: 'Name of the folder to remove',
      example: 'old-folder'
    }),
    custom_config: z.string().optional()
  })
  .openapi('FolderRemoveQuery');

/**
 * Successful folder removal response
 */
export const FolderRemoveSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220)
    })
  })
  .openapi('FolderRemoveSuccessResponse');
