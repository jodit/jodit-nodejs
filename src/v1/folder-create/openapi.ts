import {
  FolderCreateQuerySchema,
  FolderCreateSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/folderCreate',
  operationId: 'folderCreate',
  summary: 'Create new folder',
  description: 'Creates a new folder in the specified source',
  tags: ['Folders'],
  request: {
    query: FolderCreateQuerySchema
  },
  responses: {
    200: {
      description: 'Folder successfully created',
      content: {
        'application/json': {
          schema: FolderCreateSuccessResponseSchema
        }
      }
    },
    400: {
      description: 'Bad request - validation error or folder already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Source or directory not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error - folder was not created',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
};
