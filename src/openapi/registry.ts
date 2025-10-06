import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  FilesQuerySchema,
  FilesSuccessResponseSchema,
  ErrorResponseSchema,
  PingResponseSchema
} from '../schemas';

export const registry = new OpenAPIRegistry();

// Register GET /?action=files
registry.registerPath({
  method: 'get',
  path: '/',
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
});

// Register GET /ping
registry.registerPath({
  method: 'get',
  path: '/ping',
  summary: 'Health check',
  description: 'Check if the service is running',
  tags: ['System'],
  responses: {
    200: {
      description: 'Service is running',
      content: {
        'application/json': {
          schema: PingResponseSchema
        }
      }
    }
  }
});
