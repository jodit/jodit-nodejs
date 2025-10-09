import { GeneratePdfQuerySchema, ErrorResponseSchema } from '../../schemas';

export default {
  method: 'get' as const,
  path: '/generatePdf',
  operationId: 'generatePdf',
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
      description: 'Internal server error - failed to generate PDF',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
};
