import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for image resize
 * Note: Supports both formats:
 * - POST body (extended: true): { box: { w, h } }
 * - GET query string: { 'box[w]', 'box[h]' }
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
    })
  })
  .passthrough()
  .transform(data => {
    // Handle both formats: nested object (POST body) and flat keys (GET query)
    let box: { w: number; h: number };

    if (data.box && typeof data.box === 'object' && 'w' in data.box && 'h' in data.box) {
      // Format 1: { box: { w, h } } (from POST body with extended: true)
      const boxObj = data.box as { w: unknown; h: unknown };
      box = {
        w: typeof boxObj.w === 'string' ? parseInt(boxObj.w, 10) : (boxObj.w as number),
        h: typeof boxObj.h === 'string' ? parseInt(boxObj.h, 10) : (boxObj.h as number)
      };
    } else if (data['box[w]'] != null && data['box[h]'] != null) {
      // Format 2: { 'box[w]', 'box[h]' } (from GET query string)
      const w = data['box[w]'];
      const h = data['box[h]'];
      box = {
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
    z.object({
      action: z.literal('imageResize').optional(),
      source: z.string().optional(),
      path: z.string().optional(),
      name: z.string(),
      newname: z.string().optional(),
      box: z.object({
        w: z.number().int().positive(),
        h: z.number().int().positive()
      })
    }).passthrough()
  )
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
