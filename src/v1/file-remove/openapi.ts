import {
  FileRemoveQuerySchema,
  FileRemoveSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/fileRemove',
  operationId: 'fileRemove',
  summary: 'Remove file',
  description: 'Removes a file from the specified source',
  tags: ['Files'],
  request: {
    query: FileRemoveQuerySchema
  },
  responses: {
    200: {
      description: 'File successfully removed',
      content: {
        'application/json': {
          schema: FileRemoveSuccessResponseSchema
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
    404: {
      description: 'File or source not found',
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
