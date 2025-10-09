import {
  ImageResizeQuerySchema,
  ImageResizeSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/imageResize',
  operationId: 'imageResize',
  summary: 'Resize image',
  description: 'Resizes an image to specified dimensions',
  tags: ['Images'],
  request: {
    query: ImageResizeQuerySchema
  },
  responses: {
    200: {
      description: 'Image successfully resized',
      content: {
        'application/json': {
          schema: ImageResizeSuccessResponseSchema
        }
      }
    },
    400: {
      description:
        'Bad request - validation error, invalid dimensions, or file already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Source or image file not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error - failed to resize image',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
};
