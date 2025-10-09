import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// File download query schema
export const FileDownloadQuerySchema = z
  .object({
    action: z.literal('fileDownload').optional().describe('Action type').openapi({
      description: 'Action type',
      example: 'fileDownload'
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
    name: z.string().describe('File name to download').openapi({
      description: 'File name to download',
      example: 'document.pdf'
    })
  })
  .openapi('FileDownloadQuery');

export type FileDownloadQueryParams = z.infer<typeof FileDownloadQuerySchema>;
