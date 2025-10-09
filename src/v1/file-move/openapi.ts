import {
  FileMoveQuerySchema,
  FileMoveSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/fileMove',
  operationId: 'fileMove',
  summary: 'Move file or folder',
  description: 'Moves a file or folder to a different location',
  tags: ['Files'],
  request: {
    query: FileMoveQuerySchema
  },
  responses: {
    200: {
      description: 'File/folder successfully moved',
      content: {
        'application/json': {
          schema: FileMoveSuccessResponseSchema
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
      description: 'File/folder or source not found',
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
