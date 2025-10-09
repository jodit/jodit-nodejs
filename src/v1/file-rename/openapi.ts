import {
  FileRenameQuerySchema,
  FileRenameSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/fileRename',
  operationId: 'fileRename',
  summary: 'Rename file or folder',
  description: 'Renames a file or folder',
  tags: ['Files'],
  request: {
    query: FileRenameQuerySchema
  },
  responses: {
    200: {
      description: 'File/folder successfully renamed',
      content: {
        'application/json': {
          schema: FileRenameSuccessResponseSchema
        }
      }
    },
    400: {
      description: 'Bad request - validation error or file already exists',
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
