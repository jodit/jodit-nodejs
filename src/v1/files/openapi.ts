import {
  FilesQuerySchema,
  FilesSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/files',
  operationId: 'files',
  summary: 'Get list of files',
  description: 'Returns list of files from specified source',
  tags: ['Files'],
  request: {
    query: FilesQuerySchema
  },
  responses: {
    200: {
      description: 'Successful response with files list',
      content: {
        'application/json': {
          schema: FilesSuccessResponseSchema
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
      description: 'Source not found',
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
