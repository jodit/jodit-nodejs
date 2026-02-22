import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for image crop
 * Note: Supports both formats:
 * - POST body (extended: true): { box: { x, y, w, h } }
 * - GET query string: { 'box[x]', 'box[y]', 'box[w]', 'box[h]' }
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
    })
  })
  .passthrough()
  .transform(data => {
    // Handle both formats: nested object (POST body) and flat keys (GET query)
    let box: { x: number; y: number; w: number; h: number };

    if (
      data.box &&
      typeof data.box === 'object' &&
      'x' in data.box &&
      'y' in data.box &&
      'w' in data.box &&
      'h' in data.box
    ) {
      // Format 1: { box: { x, y, w, h } } (from POST body with extended: true)
      const boxObj = data.box as {
        x: unknown;
        y: unknown;
        w: unknown;
        h: unknown;
      };
      box = {
        x:
          typeof boxObj.x === 'string'
            ? parseInt(boxObj.x, 10)
            : (boxObj.x as number),
        y:
          typeof boxObj.y === 'string'
            ? parseInt(boxObj.y, 10)
            : (boxObj.y as number),
        w:
          typeof boxObj.w === 'string'
            ? parseInt(boxObj.w, 10)
            : (boxObj.w as number),
        h:
          typeof boxObj.h === 'string'
            ? parseInt(boxObj.h, 10)
            : (boxObj.h as number)
      };
    } else if (
      data['box[x]'] != null &&
      data['box[y]'] != null &&
      data['box[w]'] != null &&
      data['box[h]'] != null
    ) {
      // Format 2: { 'box[x]', 'box[y]', 'box[w]', 'box[h]' } (from GET query string)
      const x = data['box[x]'];
      const y = data['box[y]'];
      const w = data['box[w]'];
      const h = data['box[h]'];
      box = {
        x: typeof x === 'string' ? parseInt(x, 10) : (x as number),
        y: typeof y === 'string' ? parseInt(y, 10) : (y as number),
        w: typeof w === 'string' ? parseInt(w, 10) : (w as number),
        h: typeof h === 'string' ? parseInt(h, 10) : (h as number)
      };
    } else {
      // Neither format found - return data as is and let zod validation fail
      return data;
    }

    return { ...data, box };
  })
  .pipe(
    z
      .object({
        action: z.literal('imageCrop').optional(),
        source: z.string().optional(),
        path: z.string().optional(),
        name: z.string(),
        newname: z.string().optional(),
        box: z.object({
          x: z.number().int().min(0),
          y: z.number().int().min(0),
          w: z.number().int().positive(),
          h: z.number().int().positive()
        })
      })
      .passthrough()
  )
  .openapi('ImageCropQuery');

/**
 * Successful image crop response
 */
export const ImageCropSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220),
      newPath: z.string().openapi({
        description: 'Full URL of the cropped image',
        example: 'https://example.com/files/image-cropped.jpg'
      })
    })
  })
  .openapi('ImageCropSuccessResponse');
