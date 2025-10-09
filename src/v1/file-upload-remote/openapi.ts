import {
  FileUploadRemoteQuerySchema,
  FileUploadRemoteSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/fileUploadRemote',
  operationId: 'fileUploadRemote',
  summary: 'Upload file from remote URL',
  description: 'Downloads a file from a remote URL and saves it to the source',
  tags: ['Files'],
  request: {
    query: FileUploadRemoteQuerySchema
  },
  responses: {
    200: {
      description: 'File successfully uploaded',
      content: {
        'application/json': {
          schema: FileUploadRemoteSuccessResponseSchema
        }
      }
    },
    400: {
      description: 'Bad request - invalid URL or target directory',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    403: {
      description: 'Forbidden - file validation failed',
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
