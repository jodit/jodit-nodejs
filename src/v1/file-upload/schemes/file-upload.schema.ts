import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// File upload query schema
export const FileUploadQuerySchema = z
  .object({
    action: z.literal('fileUpload').optional().describe('Action type').openapi({
      description: 'Action type',
      example: 'fileUpload'
    }),
    source: z.string().optional().describe('Source name').openapi({
      description: 'Source name',
      example: 'test'
    }),
    path: z.string().optional().describe('Path within source').openapi({
      description: 'Path within source',
      example: '/',
      default: '/'
    })
  })
  .openapi('FileUploadQuery');

export type FileUploadQueryParams = z.infer<typeof FileUploadQuerySchema>;

// File upload success response
export const FileUploadSuccessResponseSchema = z
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
        baseurl: z.string().describe('Base URL for uploaded files').openapi({
          description: 'Base URL for uploaded files',
          example: 'http://localhost:3000/files/test/'
        }),
        files: z
          .array(z.string())
          .describe('List of uploaded file names')
          .openapi({
            description: 'List of uploaded file names',
            example: ['image.png', 'document.pdf']
          }),
        isImages: z
          .array(z.boolean())
          .describe('Whether each file is an image')
          .openapi({
            description: 'Whether each file is an image',
            example: [true, false]
          }),
        messages: z
          .array(z.string())
          .describe('Upload status messages')
          .openapi({
            description: 'Upload status messages',
            example: [
              'File image.png was uploaded',
              'File document.pdf was uploaded'
            ]
          })
      })
      .describe('Response data')
  })
  .openapi('FileUploadSuccessResponse');
