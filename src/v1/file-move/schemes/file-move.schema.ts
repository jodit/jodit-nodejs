import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// File move query schema
export const FileMoveQuerySchema = z
  .object({
    action: z.literal('fileMove').optional().describe('Action type').openapi({
      description: 'Action type',
      example: 'fileMove'
    }),
    source: z.string().optional().describe('Source name').openapi({
      description: 'Source name',
      example: 'test'
    }),
    path: z
      .string()
      .optional()
      .describe('Destination path within source')
      .openapi({
        description: 'Destination path within source',
        example: '/subfolder',
        default: '/'
      }),
    from: z.string().describe('Source file/folder path to move').openapi({
      description: 'Source file/folder path to move',
      example: '/file.txt'
    })
  })
  .openapi('FileMoveQuery');

export type FileMoveQueryParams = z.infer<typeof FileMoveQuerySchema>;

// File move success response
export const FileMoveSuccessResponseSchema = z
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
  .openapi('FileMoveSuccessResponse');
