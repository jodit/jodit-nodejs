import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for saving an edited image. The image bytes themselves are
 * sent as a multipart file field (see openapi.ts); these are the accompanying
 * fields.
 */
export const ImageSaveQuerySchema = z
  .object({
    action: z.literal('imageSave').optional().openapi({
      description: 'Action name',
      example: 'imageSave'
    }),
    source: z.string().optional().openapi({
      description: 'Source name (defaults to the first source)',
      example: 'test'
    }),
    path: z.string().optional().openapi({
      description: 'Directory path within source (default: "/")',
      example: '/',
      default: '/'
    }),
    name: z.string().optional().openapi({
      description:
        'Original image filename. Used as the save target when "newname" is omitted (overwrite in place).',
      example: 'photo.jpg'
    }),
    newname: z.string().optional().openapi({
      description:
        'Target filename to save the edited image as. When omitted the original "name" is overwritten.',
      example: 'photo-edited.png'
    })
  })
  .passthrough()
  .openapi('ImageSaveQuery');

/**
 * Successful image save response
 */
export const ImageSaveSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220),
      newPath: z.string().openapi({
        description: 'Full URL of the saved image',
        example: 'https://example.com/files/photo-edited.png'
      }),
      name: z.string().openapi({
        description: 'Saved file name',
        example: 'photo-edited.png'
      })
    })
  })
  .openapi('ImageSaveSuccessResponse');
