import request from 'supertest';
import { Application } from 'express';
import { createTestApp, cleanupTestFiles } from '../test-server';

describe('Generate PDF (GET /?action=generatePdf)', () => {
  let app: Application;

  beforeEach(async () => {
    app = createTestApp();
    await cleanupTestFiles();
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  // Set timeout for PDF generation tests (puppeteer is slow)
  jest.setTimeout(15000);

  it('should generate PDF document from simple HTML', async () => {
    const html = '<h1>Test Document</h1><p>This is a test.</p>';

    const response = await request(app).get('/').query({
      action: 'generatePdf',
      html
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('document.pdf');
    expect(response.headers['content-length']).toBeDefined();

    // Check PDF signature
    const pdfSignature = response.body.toString('utf8', 0, 4);
    expect(pdfSignature).toBe('%PDF');
  });

  it('should generate PDF with complex HTML', async () => {
    const html = `
      <h1>Title</h1>
      <p>Paragraph 1</p>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
      <p>Paragraph 2 with <strong>bold</strong> and <em>italic</em></p>
    `;

    const response = await request(app).get('/').query({
      action: 'generatePdf',
      html
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');

    // Check it's a valid PDF
    const pdfSignature = response.body.toString('utf8', 0, 4);
    expect(pdfSignature).toBe('%PDF');
  });

  it('should generate PDF with styled content', async () => {
    const html = `
      <div style="color: red; font-size: 20px;">
        <p>Styled paragraph</p>
      </div>
    `;

    const response = await request(app).get('/').query({
      action: 'generatePdf',
      html
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
  });

  it('should return 400 when html parameter is missing', async () => {
    const response = await request(app).get('/').query({
      action: 'generatePdf'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toBeDefined();
  });

  it('should return 400 when html parameter is empty', async () => {
    const response = await request(app).get('/').query({
      action: 'generatePdf',
      html: ''
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should handle HTML with special characters', async () => {
    const html = '<p>Test with &amp; &lt; &gt; &quot; special chars</p>';

    const response = await request(app).get('/').query({
      action: 'generatePdf',
      html
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
  });

  it('should generate PDF with table', async () => {
    const html = `
      <table border="1">
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
        <tr>
          <td>Cell 1</td>
          <td>Cell 2</td>
        </tr>
      </table>
    `;

    const response = await request(app).get('/').query({
      action: 'generatePdf',
      html
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
  });

  it('should set correct content length header', async () => {
    const html = '<p>Simple paragraph</p>';

    const response = await request(app).get('/').query({
      action: 'generatePdf',
      html
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-length']).toBeDefined();
    expect(parseInt(response.headers['content-length'] || '0')).toBeGreaterThan(
      0
    );
  });
});
