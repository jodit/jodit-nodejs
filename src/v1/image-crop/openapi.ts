import {
  ImageCropQuerySchema,
  ImageCropSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/imageCrop',
  operationId: 'imageCrop',
  summary: 'Crop image',
  description: 'Crops an image to specified coordinates and dimensions',
  tags: ['Images'],
  request: {
    query: ImageCropQuerySchema
  },
  responses: {
    200: {
      description: 'Image successfully cropped',
      content: {
        'application/json': {
          schema: ImageCropSuccessResponseSchema
        }
      }
    },
    400: {
      description:
        'Bad request - validation error, invalid dimensions or coordinates, or file already exists',
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
      description: 'Internal server error - failed to crop image',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
};
