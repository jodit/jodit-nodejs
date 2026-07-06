import {
  FileCopyQuerySchema,
  FileCopySuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/fileCopy',
  operationId: 'fileCopy',
  summary: 'Copy file',
  description:
    'Copies a file to a different location. A name clash is resolved with a " (N)" suffix, so copying into the same folder duplicates the file.',
  tags: ['Files'],
  request: {
    query: FileCopyQuerySchema
  },
  responses: {
    200: {
      description: 'File successfully copied',
      content: {
        'application/json': {
          schema: FileCopySuccessResponseSchema
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
    }
  }
};
