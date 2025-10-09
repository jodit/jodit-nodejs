import {
  GetLocalFileByUrlQuerySchema,
  GetLocalFileByUrlSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/getLocalFileByUrl',
  operationId: 'getLocalFileByUrl',
  summary: 'Resolve local file by URL',
  description: 'Resolves a URL to local file path, name and source',
  tags: ['Files'],
  request: {
    query: GetLocalFileByUrlQuerySchema
  },
  responses: {
    200: {
      description: 'File successfully resolved',
      content: {
        'application/json': {
          schema: GetLocalFileByUrlSuccessResponseSchema
        }
      }
    },
    400: {
      description: 'Bad request - invalid URL or file not found',
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
