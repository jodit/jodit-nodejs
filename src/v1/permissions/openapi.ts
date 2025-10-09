import {
  PermissionsQuerySchema,
  PermissionsSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/permissions',
  operationId: 'permissions',
  summary: 'Get permissions',
  description: 'Returns user permissions for the specified source',
  tags: ['System'],
  request: {
    query: PermissionsQuerySchema
  },
  responses: {
    200: {
      description: 'Successful response with permissions',
      content: {
        'application/json': {
          schema: PermissionsSuccessResponseSchema
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
