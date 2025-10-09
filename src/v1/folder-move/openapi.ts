import {
  FolderMoveQuerySchema,
  FolderMoveSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/folderMove',
  operationId: 'folderMove',
  summary: 'Move folder',
  description: 'Moves a folder to a different location',
  tags: ['Folders'],
  request: {
    query: FolderMoveQuerySchema
  },
  responses: {
    200: {
      description: 'Folder successfully moved',
      content: {
        'application/json': {
          schema: FolderMoveSuccessResponseSchema
        }
      }
    },
    400: {
      description:
        'Bad request - validation error, not a directory, or destination already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Source, folder, or destination directory not found',
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
