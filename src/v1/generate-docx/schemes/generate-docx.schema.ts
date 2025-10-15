import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for document generation
 */
export const GenerateDocxQuerySchema = z
  .object({
    action: z.literal('generateDocx').optional().openapi({
      description: 'Action name',
      example: 'generateDocx'
    }),
    html: z.string().min(1).openapi({
      description: 'HTML content to convert to DOCX',
      example: '<h1>Hello World</h1><p>This is a test document.</p>'
    })
  })
  .passthrough()
  .openapi('GenerateDocxQuery');
