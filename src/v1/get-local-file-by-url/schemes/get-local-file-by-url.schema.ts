import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Get local file by URL query schema
export const GetLocalFileByUrlQuerySchema = z
  .object({
    action: z
      .literal('getLocalFileByUrl')
      .optional()
      .describe('Action type')
      .openapi({
        description: 'Action type',
        example: 'getLocalFileByUrl'
      }),
    url: z.string().describe('Full URL to resolve').openapi({
      description: 'Full URL to resolve to local file',
      example: 'http://localhost:3000/files/test/image.png'
    })
  })
  .openapi('GetLocalFileByUrlQuery');

export type GetLocalFileByUrlQueryParams = z.infer<
  typeof GetLocalFileByUrlQuerySchema
>;

// Get local file by URL success response
export const GetLocalFileByUrlSuccessResponseSchema = z
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
        path: z
          .string()
          .describe('Directory path relative to source root')
          .openapi({
            description: 'Directory path relative to source root',
            example: '/'
          }),
        name: z.string().describe('File name').openapi({
          description: 'File name',
          example: 'image.png'
        }),
        source: z.string().describe('Source name').openapi({
          description: 'Source name',
          example: 'test'
        })
      })
      .describe('Response data')
  })
  .openapi('GetLocalFileByUrlSuccessResponse');
