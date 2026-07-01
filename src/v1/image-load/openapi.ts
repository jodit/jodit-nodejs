import {
  ImageLoadQuerySchema,
  ImageLoadSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'post' as const,
  path: '/imageLoad',
  operationId: 'imageLoad',
  summary: 'Read an image as a base64 data URL',
  description:
    'Return an image file as a base64 data URL through the CORS-enabled JSON API — lets a browser on a different origin read a file the raw host would block via CORS.',
  tags: ['Images'],
  request: {
    query: ImageLoadQuerySchema
  },
  responses: {
    200: {
      description: 'Image successfully read',
      content: {
        'application/json': {
          schema: ImageLoadSuccessResponseSchema
        }
      }
    },
    400: {
      description: 'Bad request - validation error',
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
      description: 'Source or file not found',
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
