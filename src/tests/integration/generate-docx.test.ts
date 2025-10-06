import request from 'supertest';
import { Application } from 'express';
import { createTestApp, cleanupTestFiles } from '../test-server';

describe('Generate DOCX (GET /?action=generateDocx)', () => {
  let app: Application;

  beforeEach(async () => {
    app = createTestApp();
    await cleanupTestFiles();
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  // Helper to make request with binary response
  const requestDocx = (html: string): Promise<request.Response> => {
    return request(app)
      .get('/')
      .query({
        action: 'generateDocx',
        html
      })
      .buffer(true)
      .parse((res, callback) => {
        res.setEncoding('binary');
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          callback(null, Buffer.from(data, 'binary'));
        });
      });
  };

  it('should generate DOCX document from simple HTML', async () => {
    const html = '<h1>Test Document</h1><p>This is a test.</p>';
    const response = await requestDocx(html);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('document.docx');
    expect(response.headers['content-length']).toBeDefined();

    // Check it's a valid DOCX file (ZIP signature)
    const zipSignature = response.body.toString('hex', 0, 4);
    expect(zipSignature).toBe('504b0304'); // PK.. signature
  });

  it('should generate DOCX with complex HTML', async () => {
    const html = `
      <h1>Title</h1>
      <p>Paragraph 1</p>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
      <p>Paragraph 2 with <strong>bold</strong> and <em>italic</em></p>
    `;
    const response = await requestDocx(html);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    // Check it's a valid DOCX file
    const zipSignature = response.body.toString('hex', 0, 4);
    expect(zipSignature).toBe('504b0304');
  });

  it('should generate DOCX with divs', async () => {
    const html = '<div>Section 1</div><div>Section 2</div>';
    const response = await requestDocx(html);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    // Check it's a valid DOCX file
    const zipSignature = response.body.toString('hex', 0, 4);
    expect(zipSignature).toBe('504b0304');
  });

  it('should generate DOCX with page break', async () => {
    const html =
      '<p>Page 1</p><div style="page-break-after:always"></div><p>Page 2</p>';
    const response = await requestDocx(html);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });

  it('should return 400 when html parameter is missing', async () => {
    const response = await request(app).get('/').query({
      action: 'generateDocx'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toBeDefined();
  });

  it('should return 400 when html parameter is empty', async () => {
    const response = await request(app).get('/').query({
      action: 'generateDocx',
      html: ''
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should handle multiple paragraphs', async () => {
    const html = '<p>Paragraph 1</p><p>Paragraph 2</p><p>Paragraph 3</p>';
    const response = await requestDocx(html);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    // Check it's a valid DOCX file
    const zipSignature = response.body.toString('hex', 0, 4);
    expect(zipSignature).toBe('504b0304');
  });

  it('should generate proper DOCX format with headings', async () => {
    const html = '<h1>Heading 1</h1><h2>Heading 2</h2><p>Content</p>';
    const response = await requestDocx(html);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    // Check it's a valid DOCX file (ZIP signature)
    const zipSignature = response.body.toString('hex', 0, 4);
    expect(zipSignature).toBe('504b0304');

    // Check file size is reasonable
    expect(response.body.length).toBeGreaterThan(100);
  });
});
