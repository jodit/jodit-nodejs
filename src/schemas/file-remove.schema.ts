import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// File remove query schema
export const FileRemoveQuerySchema = z
  .object({
    action: z.literal('fileRemove').describe('Action type').openapi({
      description: 'Action type',
      example: 'fileRemove'
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
    name: z.string().describe('File name to remove').openapi({
      description: 'File name to remove',
      example: 'image.png'
    })
  })
  .openapi('FileRemoveQuery');

export type FileRemoveQueryParams = z.infer<typeof FileRemoveQuerySchema>;

// File remove success response
export const FileRemoveSuccessResponseSchema = z
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
  .openapi('FileRemoveSuccessResponse');
