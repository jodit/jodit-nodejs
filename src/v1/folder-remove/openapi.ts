import {
  FolderRemoveQuerySchema,
  FolderRemoveSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/folderRemove',
  operationId: 'folderRemove',
  summary: 'Remove folder',
  description:
    'Removes a folder and all its contents from the specified source',
  tags: ['Folders'],
  request: {
    query: FolderRemoveQuerySchema
  },
  responses: {
    200: {
      description: 'Folder successfully removed',
      content: {
        'application/json': {
          schema: FolderRemoveSuccessResponseSchema
        }
      }
    },
    400: {
      description: 'Bad request - validation error or not a directory',
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
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
};
