import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for folder rename
 */
export const FolderRenameQuerySchema = z
  .object({
    action: z.literal('folderRename').optional().openapi({
      description: 'Action name',
      example: 'folderRename'
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
      description: 'Current folder name',
      example: 'old-folder-name'
    }),
    newname: z.string().openapi({
      description: 'New folder name',
      example: 'new-folder-name'
    }),
    custom_config: z.string().optional()
  })
  .openapi('FolderRenameQuery');

/**
 * Successful folder rename response
 */
export const FolderRenameSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220)
    })
  })
  .openapi('FolderRenameSuccessResponse');
