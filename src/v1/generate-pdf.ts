import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import puppeteer from 'puppeteer';
import { GeneratePdfQuerySchema } from '../schemas';
import { logger } from '../helpers/logger';

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

  logger.debug('Generating PDF document from HTML using Puppeteer');

  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set content
    await page.setContent(query.html, {
      waitUntil: 'networkidle0'
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });

    await browser.close();

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');

    res.send(pdfBuffer);
  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {
        /* ignore */
      });
    }
    logger.error(`Failed to generate PDF: ${error}`);
    throw Boom.internal('Failed to generate PDF', ['Failed to generate PDF']);
  }
}
