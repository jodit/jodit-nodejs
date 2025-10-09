import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { GeneratePdfQuerySchema, PdfOptionsSchema } from '../../schemas';
import { logger } from '../../helpers/logger';
import { withBrowser } from '../../helpers/browser-pool';
import type { PdfOptions } from './schemes/generate-pdf.schema';

/**
 * Handler for generating PDF documents from HTML using Puppeteer
 * GET /?action=generatePdf&html=<html content>
 */
export async function generatePdfHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate query parameters
  const queryValidation = GeneratePdfQuerySchema.safeParse(req.query);

  if (queryValidation.success === false) {
    const messages = queryValidation.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );

    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = messages;
    throw boomError;
  }

  const query = queryValidation.data;

  if (query.html == null || query.html.trim() === '') {
    const boomError = Boom.badRequest('Need html parameter');
    boomError.output.payload.messages = ['Need html parameter'];
    throw boomError;
  }

  // Parse options parameter
  let options: PdfOptions = {};

  if (typeof query.options === 'object') {
    const optionsValidation = PdfOptionsSchema.safeParse(query.options);
    if (optionsValidation.success) {
      options = optionsValidation.data;
    }
  }

  logger.debug('Generating PDF document from HTML using Puppeteer');

  try {
    // Use browser pool to reuse browser instance across requests
    const pdfBuffer = await withBrowser(async (browser) => {
      const page = await browser.newPage();

      try {
        // Set content
        await page.setContent(query.html, {
          waitUntil: 'networkidle0'
        });

        // Generate PDF with options
        const pdf = await page.pdf({
          format: options.format ?? 'A4',
          landscape: options.page_orientation === 'landscape',
          printBackground: true,
          margin: {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm'
          }
        });

        return pdf;
      } finally {
        // Always close the page to free resources
        await page.close();
      }
    });

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');

    res.send(pdfBuffer);
  } catch (error) {
    logger.error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    const boomError = Boom.internal('Failed to generate PDF');
    boomError.output.payload.messages = ['Failed to generate PDF'];
    throw boomError;
  }
}
