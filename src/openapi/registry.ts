import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  FilesQuerySchema,
  FilesSuccessResponseSchema,
  ErrorResponseSchema,
  PingResponseSchema,
  FileRemoveQuerySchema,
  FileRemoveSuccessResponseSchema,
  FileMoveQuerySchema,
  FileMoveSuccessResponseSchema,
  FileRenameQuerySchema,
  FileRenameSuccessResponseSchema,
  FileDownloadQuerySchema,
  GetLocalFileByUrlQuerySchema,
  GetLocalFileByUrlSuccessResponseSchema,
  FileUploadRemoteQuerySchema,
  FileUploadRemoteSuccessResponseSchema,
  FolderCreateQuerySchema,
  FolderCreateSuccessResponseSchema,
  FolderRemoveQuerySchema,
  FolderRemoveSuccessResponseSchema,
  FolderMoveQuerySchema,
  FolderMoveSuccessResponseSchema,
  FolderRenameQuerySchema,
  FolderRenameSuccessResponseSchema,
  FoldersQuerySchema,
  FoldersSuccessResponseSchema,
  PermissionsQuerySchema,
  PermissionsSuccessResponseSchema,
  ImageResizeQuerySchema,
  ImageResizeSuccessResponseSchema,
  ImageCropQuerySchema,
  ImageCropSuccessResponseSchema,
  GenerateDocxQuerySchema,
  GeneratePdfQuerySchema,
  FileUploadQuerySchema,
  FileUploadSuccessResponseSchema
} from '../schemas';

export const registry = new OpenAPIRegistry();

// Register GET /?action=files
registry.registerPath({
  method: 'get',
  path: '/',
  summary: 'Get list of files',
  description: 'Returns list of files from specified source',
  tags: ['Files'],
  request: {
    query: FilesQuerySchema
  },
  responses: {
    200: {
      description: 'Successful response with files list',
      content: {
        'application/json': {
          schema: FilesSuccessResponseSchema
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
});

// Register POST /?action=fileUpload
registry.registerPath({
  method: 'post',
  path: '/',
  summary: 'Upload files',
  description: 'Upload one or more files to the specified source via multipart/form-data',
  tags: ['Files'],
  request: {
    query: FileUploadQuerySchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'binary'
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
});

// Register GET /?action=fileRemove
registry.registerPath({
  method: 'get',
  path: '/',
  summary: 'Remove file',
  description: 'Removes a file from the specified source',
  tags: ['Files'],
  request: {
    query: FileRemoveQuerySchema
  },
  responses: {
    200: {
      description: 'File successfully removed',
      content: {
        'application/json': {
          schema: FileRemoveSuccessResponseSchema
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
});

// Register GET /?action=fileMove
registry.registerPath({
  method: 'get',
  path: '/',
  summary: 'Move file or folder',
  description: 'Moves a file or folder to a different location',
  tags: ['Files'],
  request: {
    query: FileMoveQuerySchema
  },
  responses: {
    200: {
      description: 'File/folder successfully moved',
      content: {
        'application/json': {
          schema: FileMoveSuccessResponseSchema
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
});

// Register GET /?action=fileRename
registry.registerPath({
  method: 'get',
  path: '/',
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
});

// Register GET /?action=fileDownload
registry.registerPath({
  method: 'get',
  path: '/',
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
            type: 'string',
            format: 'binary'
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
});

// Register GET /?action=getLocalFileByUrl
registry.registerPath({
  method: 'get',
  path: '/',
  summary: 'Resolve local file by URL',
  description: 'Resolves a URL to local file path, name and source',
  tags: ['Files'],
  request: {
    query: GetLocalFileByUrlQuerySchema
  },
  responses: {
    200: {
      description: 'File successfully resolved',
      content: {
        'application/json': {
          schema: GetLocalFileByUrlSuccessResponseSchema
        }
      }
    },
    400: {
      description: 'Bad request - invalid URL or file not found',
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
});

// Register GET /?action=fileUploadRemote
registry.registerPath({
  method: 'get',
  path: '/',
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
});

// Register GET /?action=folderCreate
registry.registerPath({
  method: 'get',
  path: '/',
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
});

// Register GET /?action=folderRemove
registry.registerPath({
  method: 'get',
  path: '/',
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
});

// Register GET /?action=folderMove
registry.registerPath({
  method: 'get',
  path: '/',
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
});

// Register GET /?action=folderRename
registry.registerPath({
  method: 'get',
  path: '/',
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
});

// Register GET /?action=folders
registry.registerPath({
  method: 'get',
  path: '/',
  summary: 'Get folders list',
  description: 'Returns list of folders from specified source(s)',
  tags: ['Folders'],
  request: {
    query: FoldersQuerySchema
  },
  responses: {
    200: {
      description: 'Successful response with folders list',
      content: {
        'application/json': {
          schema: FoldersSuccessResponseSchema
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
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

// Register GET /?action=permissions
registry.registerPath({
  method: 'get',
  path: '/',
  summary: 'Get permissions',
  description: 'Returns user permissions for the specified source',
  tags: ['System'],
  request: {
    query: PermissionsQuerySchema
  },
  responses: {
    200: {
      description: 'Successful response with permissions',
      content: {
        'application/json': {
          schema: PermissionsSuccessResponseSchema
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
});

// Register GET /?action=imageResize
registry.registerPath({
  method: 'get',
  path: '/',
  summary: 'Resize image',
  description: 'Resizes an image to specified dimensions',
  tags: ['Images'],
  request: {
    query: ImageResizeQuerySchema
  },
  responses: {
    200: {
      description: 'Image successfully resized',
      content: {
        'application/json': {
          schema: ImageResizeSuccessResponseSchema
        }
      }
    },
    400: {
      description:
        'Bad request - validation error, invalid dimensions, or file already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Source or image file not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error - failed to resize image',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

// Register GET /?action=imageCrop
registry.registerPath({
  method: 'get',
  path: '/',
  summary: 'Crop image',
  description: 'Crops an image to specified coordinates and dimensions',
  tags: ['Images'],
  request: {
    query: ImageCropQuerySchema
  },
  responses: {
    200: {
      description: 'Image successfully cropped',
      content: {
        'application/json': {
          schema: ImageCropSuccessResponseSchema
        }
      }
    },
    400: {
      description:
        'Bad request - validation error, invalid dimensions or coordinates, or file already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Source or image file not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error - failed to crop image',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

// Register GET /?action=generateDocx
registry.registerPath({
  method: 'get',
  path: '/',
  summary: 'Generate DOCX document',
  description: 'Converts HTML content to DOCX format using @turbodocx/html-to-docx',
  tags: ['Documents'],
  request: {
    query: GenerateDocxQuerySchema
  },
  responses: {
    200: {
      description: 'DOCX file successfully generated',
      content: {
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          {
            schema: {
              type: 'string',
              format: 'binary'
            }
          }
      }
    },
    400: {
      description: 'Bad request - missing html parameter',
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
});

// Register GET /?action=generatePdf
registry.registerPath({
  method: 'get',
  path: '/',
  summary: 'Generate PDF document',
  description: 'Converts HTML content to PDF format',
  tags: ['Documents'],
  request: {
    query: GeneratePdfQuerySchema
  },
  responses: {
    200: {
      description: 'PDF file successfully generated',
      content: {
        'application/pdf': {
          schema: {
            type: 'string',
            format: 'binary'
          }
        }
      }
    },
    400: {
      description: 'Bad request - missing html parameter',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error - failed to generate PDF',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

// Register GET /ping
registry.registerPath({
  method: 'get',
  path: '/ping',
  summary: 'Health check',
  description: 'Check if the service is running',
  tags: ['System'],
  responses: {
    200: {
      description: 'Service is running',
      content: {
        'application/json': {
          schema: PingResponseSchema
        }
      }
    }
  }
});
