import { GenerateDocxQuerySchema, ErrorResponseSchema } from '../../schemas';

export default {
  method: 'get' as const,
  path: '/generateDocx',
  operationId: 'generateDocx',
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
              type: 'string' as const,
              format: 'binary' as const
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
};
