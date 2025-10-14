import {
  FileUploadQuerySchema,
  FileUploadSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'post' as const,
  path: '/fileUpload',
  operationId: 'fileUpload',
  summary: 'Upload files',
  description:
    'Upload one or more files to the specified source via multipart/form-data',
  tags: ['Files'],
  request: {
    query: FileUploadQuerySchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object' as const,
            properties: {
              files: {
                type: 'array' as const,
                items: {
                  type: 'string' as const,
                  format: 'binary' as const
                },
                description: 'Files to upload'
              }
            },
            required: ['files']
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Files successfully uploaded',
      content: {
        'application/json': {
          schema: FileUploadSuccessResponseSchema
        }
      }
    },
    400: {
      description: 'Bad request - validation error or no files uploaded',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    403: {
      description: 'Forbidden - file extension not allowed',
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
