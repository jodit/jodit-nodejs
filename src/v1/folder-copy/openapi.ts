import {
  FolderCopyQuerySchema,
  FolderCopySuccessResponseSchema,
  ErrorResponseSchema
} from '../../schemas';

export default {
  method: 'get' as const,
  path: '/folderCopy',
  operationId: 'folderCopy',
  summary: 'Copy folder',
  description:
    'Recursively copies a folder to a different location. A name clash is resolved with a " (N)" suffix. Copying a folder into itself or its own subtree is rejected.',
  tags: ['Folders'],
  request: {
    query: FolderCopyQuerySchema
  },
  responses: {
    200: {
      description: 'Folder successfully copied',
      content: {
        'application/json': {
          schema: FolderCopySuccessResponseSchema
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
      description: 'Folder or source not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
};
