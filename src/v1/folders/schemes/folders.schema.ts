import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for getting folders list
 */
export const FoldersQuerySchema = z
  .object({
    action: z.literal('folders').optional().openapi({
      description: 'Action name',
      example: 'folders'
    }),
    source: z.string().optional().openapi({
      description:
        'Source name (if not specified, returns folders from all sources)',
      example: 'test'
    }),
    path: z.string().optional().openapi({
      description: 'Path within source (default: "/")',
      example: '/',
      default: '/'
    }),
    dots: z
      .union([z.boolean(), z.literal('false'), z.literal('true')])
      .optional()
      .transform(val => {
        if (val === 'false') return false;
        if (val === 'true') return true;
        return val;
      })
      .openapi({
        description: 'Include parent directory (..) navigation (default: true)',
        example: true
      }),
    custom_config: z.string().optional()
  })
  .openapi('FoldersQuery');

/**
 * Single source folders data
 */
const SourceFoldersSchema = z.object({
  name: z.string().openapi({ example: 'test' }),
  title: z.string().openapi({ example: 'Test Files' }),
  baseurl: z.string().openapi({ example: 'http://localhost:8081/files/test/' }),
  path: z.string().openapi({ example: '/' }),
  folders: z.array(z.string()).openapi({
    example: ['..', 'folder1', 'folder2']
  })
});

/**
 * Successful folders list response
 */
export const FoldersSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220),
      sources: z.array(SourceFoldersSchema)
    })
  })
  .openapi('FoldersSuccessResponse');
