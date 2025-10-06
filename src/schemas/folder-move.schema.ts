import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for folder move
 */
export const FolderMoveQuerySchema = z
  .object({
    action: z.literal('folderMove').openapi({
      description: 'Action name',
      example: 'folderMove'
    }),
    source: z.string().optional().openapi({
      description: 'Source name (defaults to "files")',
      example: 'test'
    }),
    from: z.string().openapi({
      description: 'Source folder path relative to source root',
      example: '/old-location/folder-name'
    }),
    path: z.string().optional().openapi({
      description: 'Destination directory path (default: "/")',
      example: '/new-location/',
      default: '/'
    }),
    custom_config: z.string().optional()
  })
  .openapi('FolderMoveQuery');

/**
 * Successful folder move response
 */
export const FolderMoveSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220)
    })
  })
  .openapi('FolderMoveSuccessResponse');
