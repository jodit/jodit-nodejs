import {
  FolderRenameQuerySchema,
  FolderRenameSuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/folderRename',
  operationId: 'folderRename',
  summary: 'Rename folder',
  description: 'Renames a folder',
  tags: ['Folders'],
  request: {
    query: FolderRenameQuerySchema
  },
  responses: {
    200: {
      description: 'Folder successfully renamed',
      content: {
        'application/json': {
          schema: FolderRenameSuccessResponseSchema
        }
      }
    },
    400: {
      description:
        'Bad request - validation error, not a directory, or new name already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Source or folder not found',
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
