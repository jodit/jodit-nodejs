import {
  FoldersQuerySchema,
  FoldersSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/folders',
  operationId: 'folders',
  summary: 'Get folders list',
  description: 'Returns list of folders from specified source(s)',
  tags: ['Folders'],
  request: {
    query: FoldersQuerySchema
  },
  responses: {
    200: {
      description: 'Successful response with folders list',
      content: {
        'application/json': {
          schema: FoldersSuccessResponseSchema
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
