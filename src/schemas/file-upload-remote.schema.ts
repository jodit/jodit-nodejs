import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// File upload remote query schema
export const FileUploadRemoteQuerySchema = z
  .object({
    action: z.literal('fileUploadRemote').describe('Action type').openapi({
      description: 'Action type',
      example: 'fileUploadRemote'
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
    url: z.string().url().describe('Remote file URL to download').openapi({
      description: 'Remote file URL to download',
      example: 'https://example.com/image.png'
    })
  })
  .openapi('FileUploadRemoteQuery');

export type FileUploadRemoteQueryParams = z.infer<
  typeof FileUploadRemoteQuerySchema
>;

// File upload remote success response
export const FileUploadRemoteSuccessResponseSchema = z
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
          .openapi({ description: 'Response code', example: 220 }),
        baseurl: z.string().describe('Base URL for the file').openapi({
          description: 'Base URL for the file',
          example: 'http://localhost:3000/files/test/'
        }),
        newfilename: z.string().describe('Saved file name').openapi({
          description: 'Saved file name',
          example: 'image.png'
        }),
        isImage: z.boolean().describe('Whether the file is an image').openapi({
          description: 'Whether the file is an image',
          example: true
        })
      })
      .describe('Response data')
  })
  .openapi('FileUploadRemoteSuccessResponse');
