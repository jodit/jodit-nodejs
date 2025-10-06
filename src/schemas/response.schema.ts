import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// File item schema
export const FileItemSchema = z
  .object({
    file: z
      .string()
      .describe('File name')
      .openapi({ description: 'File name', example: 'image.png' }),
    name: z
      .string()
      .describe('Display name')
      .openapi({ description: 'Display name', example: 'image.png' }),
    type: z
      .enum(['file', 'folder'])
      .describe('Item type')
      .openapi({ description: 'Item type', example: 'file' }),
    size: z
      .number()
      .optional()
      .describe('File size in bytes')
      .openapi({ description: 'File size in bytes', example: 1024 }),
    changed: z
      .string()
      .optional()
      .describe('Last modified date (ISO)')
      .openapi({
        description: 'Last modified date (ISO)',
        example: '2025-01-01T00:00:00.000Z'
      }),
    isImage: z
      .boolean()
      .optional()
      .describe('Whether file is an image')
      .openapi({ description: 'Whether file is an image', example: true }),
    thumb: z
      .string()
      .optional()
      .describe('Thumbnail URL')
      .openapi({ description: 'Thumbnail URL', example: '/thumbs/image.png' })
  })
  .openapi('FileItem');

// Source data schema
export const SourceDataSchema = z
  .object({
    name: z
      .string()
      .describe('Source name')
      .openapi({ description: 'Source name', example: 'test' }),
    title: z
      .string()
      .describe('Source title')
      .openapi({ description: 'Source title', example: 'Test Files' }),
    baseurl: z
      .string()
      .describe('Base URL for files')
      .openapi({
        description: 'Base URL for files',
        example: 'http://localhost:3000/files/test/'
      }),
    path: z
      .string()
      .describe('Current path')
      .openapi({ description: 'Current path', example: '/' }),
    files: z
      .array(FileItemSchema)
      .describe('List of files and folders')
      .openapi({ description: 'List of files and folders' })
  })
  .openapi('SourceData');

// Success response for files action
export const FilesSuccessResponseSchema = z
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
        sources: z
          .array(SourceDataSchema)
          .describe('List of sources with files')
          .openapi({ description: 'List of sources with files' })
      })
      .describe('Response data')
  })
  .openapi('FilesSuccessResponse');

// Error response
export const ErrorResponseSchema = z
  .object({
    success: z
      .literal(false)
      .describe('Request failed status')
      .openapi({ description: 'Request failed status' }),
    data: z
      .object({
        code: z
          .number()
          .describe('Error code')
          .openapi({ description: 'Error code', example: 400 }),
        messages: z
          .array(z.string())
          .describe('Error messages')
          .openapi({
            description: 'Error messages',
            example: ['Validation failed']
          })
      })
      .describe('Error data')
  })
  .openapi('ErrorResponse');

// Ping response
export const PingResponseSchema = z
  .object({
    success: z
      .literal(true)
      .describe('Service is running')
      .openapi({ description: 'Service is running' })
  })
  .openapi('PingResponse');
