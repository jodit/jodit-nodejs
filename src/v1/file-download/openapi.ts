import { FileDownloadQuerySchema, ErrorResponseSchema } from '../../schemas';

export default {
  method: 'get' as const,
  path: '/fileDownload',
  operationId: 'fileDownload',
  summary: 'Download file',
  description: 'Downloads a file with proper headers for browser download',
  tags: ['Files'],
  request: {
    query: FileDownloadQuerySchema
  },
  responses: {
    200: {
      description: 'File download stream',
      content: {
        'application/octet-stream': {
          schema: {
            type: 'string' as const,
            format: 'binary' as const
          }
        }
      }
    },
    400: {
      description: 'Bad request - validation error or not a file',
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
