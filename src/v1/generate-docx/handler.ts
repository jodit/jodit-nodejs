import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import HTMLtoDOCX from '@turbodocx/html-to-docx';
import * as cheerio from 'cheerio';
import { GenerateDocxQuerySchema } from '../../schemas';
import { logger } from '../../helpers/logger';

export async function generateDocxHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate query parameters
  const queryValidation = GenerateDocxQuerySchema.safeParse(req.context.data);
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

  logger.debug('Generating DOCX document from HTML');

  try {
    // Strip <style> and <script> tags — DOCX doesn't support them and they render as plain text
    const $ = cheerio.load(query.html);
    $('style, script').remove();
    const cleanHtml = $.html();

    // Convert HTML to DOCX using turbodocx
    const docxResult = await HTMLtoDOCX(
      cleanHtml,
      null, // no header
      {
        margins: {
          top: 720, // 0.5 inch = 720 twips
          right: 720,
          bottom: 720,
          left: 720
        }
      },
      null // no footer
    );

    // Convert result to Buffer if needed
    const docxBuffer =
      docxResult instanceof Buffer
        ? docxResult
        : Buffer.from(docxResult as ArrayBuffer);

    // Set headers for DOCX download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Length', docxBuffer.length.toString());
    res.setHeader('Expires', '0');
    res.setHeader(
      'Cache-Control',
      'must-revalidate, post-check=0, pre-check=0'
    );
    res.setHeader('Content-Disposition', 'attachment;filename=document.docx');

    res.send(docxBuffer);
  } catch (error) {
    logger.error(`Failed to generate DOCX: ${error}`);
    throw Boom.internal('Failed to generate DOCX', ['Failed to generate DOCX']);
  }
}
