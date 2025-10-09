import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for image resize
 * Note: box[w] and box[h] are parsed by Express as flat parameters
 */
export const ImageResizeQuerySchema = z
  .object({
    action: z.literal('imageResize').optional().openapi({
      description: 'Action name',
      example: 'imageResize'
    }),
    source: z.string().optional().openapi({
      description: 'Source name (defaults to "files")',
      example: 'test'
    }),
    path: z.string().optional().openapi({
      description: 'Directory path within source (default: "/")',
      example: '/',
      default: '/'
    }),
    name: z.string().openapi({
      description: 'Image filename to resize',
      example: 'image.jpg'
    }),
    newname: z.string().optional().openapi({
      description: 'New filename for resized image (defaults to original name)',
      example: 'image-resized.jpg'
    }),
    'box[w]': z.coerce.number().int().positive().openapi({
      description: 'Width in pixels',
      example: 800
    }),
    'box[h]': z.coerce.number().int().positive().openapi({
      description: 'Height in pixels',
      example: 600
    }),
    custom_config: z.string().optional()
  })
  .passthrough()
  .transform(data => ({
    ...data,
    box: {
      w: data['box[w]'],
      h: data['box[h]']
    }
  }))
  .openapi('ImageResizeQuery');

/**
 * Successful image resize response
 */
export const ImageResizeSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220)
    })
  })
  .openapi('ImageResizeSuccessResponse');
