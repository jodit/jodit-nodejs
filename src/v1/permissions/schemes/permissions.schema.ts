import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for getting permissions
 */
export const PermissionsQuerySchema = z
  .object({
    action: z.literal('permissions').optional().openapi({
      description: 'Action name',
      example: 'permissions'
    }),
    source: z.string().optional().openapi({
      description: 'Source name (defaults to "files")',
      example: 'test'
    }),
    path: z.string().optional().openapi({
      description: 'Path within source (default: "/")',
      example: '/',
      default: '/'
    }),
    custom_config: z.string().optional()
  })
  .openapi('PermissionsQuery');

/**
 * Permissions object
 */
const PermissionsSchema = z.object({
  allowFiles: z.boolean().openapi({ example: true }),
  allowFileMove: z.boolean().openapi({ example: true }),
  allowFileUpload: z.boolean().openapi({ example: true }),
  allowFileUploadRemote: z.boolean().openapi({ example: true }),
  allowFileRemove: z.boolean().openapi({ example: true }),
  allowFileRename: z.boolean().openapi({ example: true }),
  allowFolders: z.boolean().openapi({ example: true }),
  allowFolderMove: z.boolean().openapi({ example: true }),
  allowFolderCreate: z.boolean().openapi({ example: true }),
  allowFolderRemove: z.boolean().openapi({ example: true }),
  allowFolderRename: z.boolean().openapi({ example: true }),
  allowImageResize: z.boolean().openapi({ example: true }),
  allowImageCrop: z.boolean().openapi({ example: true })
});

/**
 * Successful permissions response
 */
export const PermissionsSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220),
      permissions: PermissionsSchema
    })
  })
  .openapi('PermissionsSuccessResponse');
