import {
  ImageSaveQuerySchema,
  ImageSaveSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'post' as const,
  path: '/imageSave',
  operationId: 'imageSave',
  summary: 'Save an edited image',
  description:
    'Save a client-side edited image (crop, filters, finetune, annotations already baked into the bytes). The image is sent as a multipart file field and written to `newname` (save as) or `name` (overwrite in place).',
  tags: ['Images'],
  request: {
    query: ImageSaveQuerySchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object' as const,
            properties: {
              files: {
                type: 'string' as const,
                format: 'binary' as const,
                description: 'The edited image bytes'
              }
            },
            required: ['files']
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Image successfully saved',
      content: {
        'application/json': {
          schema: ImageSaveSuccessResponseSchema
        }
      }
    },
    400: {
      description: 'Bad request - validation error, no image, or invalid image',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    403: {
      description: 'Forbidden - access denied',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Source or path not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
};
