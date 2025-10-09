import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for image crop
 * Note: box[x], box[y], box[w], box[h] are parsed by Express as flat parameters
 */
export const ImageCropQuerySchema = z
  .object({
    action: z.literal('imageCrop').optional().openapi({
      description: 'Action name',
      example: 'imageCrop'
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
      description: 'Image filename to crop',
      example: 'image.jpg'
    }),
    newname: z.string().optional().openapi({
      description: 'New filename for cropped image (defaults to original name)',
      example: 'image-cropped.jpg'
    }),
    'box[x]': z.coerce.number().int().min(0).openapi({
      description: 'X coordinate (left offset in pixels)',
      example: 100
    }),
    'box[y]': z.coerce.number().int().min(0).openapi({
      description: 'Y coordinate (top offset in pixels)',
      example: 100
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
      x: data['box[x]'],
      y: data['box[y]'],
      w: data['box[w]'],
      h: data['box[h]']
    }
  }))
  .openapi('ImageCropQuery');

/**
 * Successful image crop response
 */
export const ImageCropSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220)
    })
  })
  .openapi('ImageCropSuccessResponse');
