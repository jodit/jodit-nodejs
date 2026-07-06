import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for file copy
 */
export const FileCopyQuerySchema = z
  .object({
    action: z.literal('fileCopy').optional().openapi({
      description: 'Action name',
      example: 'fileCopy'
    }),
    source: z.string().optional().openapi({
      description: 'Source name (defaults to "files")',
      example: 'test'
    }),
    from: z.string().openapi({
      description: 'Source file path relative to source root',
      example: '/file.txt'
    }),
    path: z.string().optional().openapi({
      description: 'Destination directory path (default: "/")',
      example: '/subfolder',
      default: '/'
    })
  })
  .openapi('FileCopyQuery');

export type FileCopyQueryParams = z.infer<typeof FileCopyQuerySchema>;

/**
 * Successful file copy response
 */
export const FileCopySuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220)
    })
  })
  .openapi('FileCopySuccessResponse');
