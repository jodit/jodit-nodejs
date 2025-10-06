import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Query parameters for PDF generation
 */
export const GeneratePdfQuerySchema = z
  .object({
    action: z.literal('generatePdf').openapi({
      description: 'Action name',
      example: 'generatePdf'
    }),
    html: z.string().min(1).openapi({
      description: 'HTML content to convert to PDF',
      example: '<h1>Hello World</h1><p>This is a test document.</p>'
    }),
    custom_config: z.string().optional()
  })
  .passthrough()
  .openapi('GeneratePdfQuery');
