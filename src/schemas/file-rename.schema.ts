import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// File rename query schema
export const FileRenameQuerySchema = z
  .object({
    action: z.literal('fileRename').describe('Action type').openapi({
      description: 'Action type',
      example: 'fileRename'
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
    name: z.string().describe('Current file/folder name').openapi({
      description: 'Current file/folder name',
      example: 'old-name.txt'
    }),
    newname: z.string().describe('New file/folder name').openapi({
      description: 'New file/folder name',
      example: 'new-name.txt'
    })
  })
  .openapi('FileRenameQuery');

export type FileRenameQueryParams = z.infer<typeof FileRenameQuerySchema>;

// File rename success response
export const FileRenameSuccessResponseSchema = z
  .object({
    success: z
      .literal(true)
      .describe('Request success status')
      .openapi({ description: 'Request success status' }),
    data: z
      .object({
        code: z
          .number()
          .describe('Response code')
          .openapi({ description: 'Response code', example: 220 })
      })
      .describe('Response data')
  })
  .openapi('FileRenameSuccessResponse');
