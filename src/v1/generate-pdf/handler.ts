import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { GeneratePdfQuerySchema, PdfOptionsSchema } from '../../schemas';
import { logger } from '../../helpers/logger';
import { withBrowser } from '../../helpers/browser-pool';
import { checkRemoteResource } from '../../helpers/remote-resources';
import type { PdfOptions } from './schemes/generate-pdf.schema';
import type { RemoteResourcesConfig } from '../../types';
import type { Config } from '../../config/config';

/**
 * Handler for generating PDF documents from HTML using Puppeteer
 * GET /?action=generatePdf&html=<html content>
 */
export async function generatePdfHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate query parameters using merged context data (body + query + params)
  const queryValidation = GeneratePdfQuerySchema.safeParse(req.context.data);

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
    } else {
      const messages = optionsValidation.error.issues.map(
        issue => `${issue.path.join('.')}: ${issue.message}`
      );

      const boomError = Boom.badRequest('Invalid options');
      boomError.output.payload.messages = messages;
      throw boomError;
    }
  }

  const appConfig = req.app.locals.config as Config | undefined;
  const remotePolicy: RemoteResourcesConfig =
    appConfig?.params.remoteResources ?? {};

  logger.debug('Generating PDF document from HTML using Puppeteer');

  try {
    // Use browser pool to reuse browser instance across requests
    const pdfBuffer = await withBrowser(async browser => {
      const page = await browser.newPage();

      try {
        // The HTML comes from the client, so every URL in it is attacker
        // controlled: without this the renderer fetches whatever it is pointed
        // at and returns the response inside the PDF, which is a read/write
        // SSRF into anything the container can reach.
        await page.setRequestInterception(true);

        page.on('request', request => {
          void (async (): Promise<void> => {
            const url = request.url();
            const reason = await checkRemoteResource(url, remotePolicy);

            try {
              if (reason === null) {
                await request.continue();
                return;
              }

              logger.warn(
                `Blocked a resource while rendering PDF: ${url} (${reason})`
              );
              await request.abort('blockedbyclient');
            } catch (error) {
              // The request can be gone already (navigation, closed page);
              // nothing to do, the renderer just won't get that resource.
              logger.debug(
                `Could not settle an intercepted request: ${
                  error instanceof Error ? error.message : 'unknown error'
                }`
              );
            }
          })();
        });

        // Set content. Cap the wait: a single pooled browser serves all PDF
        // requests, so an HTML page that references unreachable resources must
        // not block it for the default 30s (these timeouts were filling the
        // logs and serializing other requests).
        await page.setContent(query.html, {
          waitUntil: 'networkidle0',
          timeout: 15000
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
    logger.error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    const boomError = Boom.internal('Failed to generate PDF');
    boomError.output.payload.messages = ['Failed to generate PDF'];
    throw boomError;
  }
}
