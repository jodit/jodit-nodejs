import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * PDF generation options schema
 */
export const PdfOptionsSchema = z.object({
  format: z
    .enum(['A4', 'A3', 'Letter', 'Legal', 'Tabloid'])
    .optional()
    .describe('Paper format'),
  page_orientation: z
    .enum(['portrait', 'landscape'])
    .optional()
    .describe('Page orientation'),
  defaultFont: z
    .enum(['courier', 'helvetica', 'times'])
    .optional()
    .describe('Default font for PDF (only standard PDF fonts supported)')
});

/**
 * Query parameters for PDF generation
 */
export const GeneratePdfQuerySchema = z
  .object({
    action: z.literal('generatePdf').optional().openapi({
      description: 'Action name',
      example: 'generatePdf'
    }),
    html: z.string().min(1).openapi({
      description: 'HTML content to convert to PDF',
      example: '<h1>Hello World</h1><p>This is a test document.</p>'
    }),
    options: z
      .union([z.string(), PdfOptionsSchema])
      .optional()
      .describe('PDF generation options'),
    custom_config: z.string().optional()
  })
  .passthrough()
  .openapi('GeneratePdfQuery');

export type PdfOptions = z.infer<typeof PdfOptionsSchema>;
