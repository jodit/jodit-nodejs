import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for folder creation
 */
export const FolderCreateQuerySchema = z
  .object({
    action: z.literal('folderCreate').openapi({
      description: 'Action name',
      example: 'folderCreate'
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
      description: 'Name of the new folder',
      example: 'new-folder'
    }),
    custom_config: z.string().optional()
  })
  .openapi('FolderCreateQuery');

/**
 * Successful folder creation response
 */
export const FolderCreateSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220),
      messages: z.array(z.string()).openapi({
        example: ['Directory successfully created']
      })
    })
  })
  .openapi('FolderCreateSuccessResponse');
