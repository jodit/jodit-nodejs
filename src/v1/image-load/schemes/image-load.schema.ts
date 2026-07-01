import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const ImageLoadQuerySchema = z
  .object({
    action: z.literal('imageLoad').optional().openapi({
      description: 'Action name',
      example: 'imageLoad'
    }),
    source: z.string().optional().openapi({
      description: 'Source name',
      example: 'test'
    }),
    path: z.string().optional().openapi({
      description: 'Directory path within source (default: "/")',
      example: '/',
      default: '/'
    }),
    name: z.string().openapi({
      description: 'Image filename to read',
      example: 'photo.jpg'
    })
  })
  .passthrough()
  .openapi('ImageLoadQuery');

export const ImageLoadSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      code: z.literal(220),
      content: z.string().openapi({
        description: 'The image as a base64 data URL',
        example: 'data:image/jpeg;base64,/9j/4AAQ…'
      }),
      name: z.string().openapi({
        description: 'File name',
        example: 'photo.jpg'
      })
    })
  })
  .openapi('ImageLoadSuccessResponse');
