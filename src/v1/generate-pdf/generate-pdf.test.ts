import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  TestServer
} from '../../tests/test-server';
import { jest } from '@jest/globals';
import { browserPool } from '../../helpers/browser-pool';

describe('Generate PDF (GET /?action=generatePdf)', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
    // Close browser to prevent hanging
    await browserPool.closeBrowser();
  });

  beforeEach(async () => {
    await cleanupTestFiles();
  });

  // Set timeout for PDF generation tests (puppeteer is slow)
  jest.setTimeout(15000);

  it('should generate PDF document from simple HTML', async () => {
    const html = '<h1>Test Document</h1><p>This is a test.</p>';

    const response = await request(testServer!.host).get('/').query({
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

    const response = await request(testServer!.host).get('/').query({
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

    const response = await request(testServer!.host).get('/').query({
      action: 'generatePdf',
      html
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
  });

  it('should return 400 when html parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'generatePdf'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toBeDefined();
  });

  it('should return 400 when html parameter is empty', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'generatePdf',
      html: ''
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should handle HTML with special characters', async () => {
    const html = '<p>Test with &amp; &lt; &gt; &quot; special chars</p>';

    const response = await request(testServer!.host).get('/').query({
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

    const response = await request(testServer!.host).get('/').query({
      action: 'generatePdf',
      html
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
  });

  it('should set correct content length header', async () => {
    const html = '<p>Simple paragraph</p>';

    const response = await request(testServer!.host).get('/').query({
      action: 'generatePdf',
      html
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-length']).toBeDefined();
    expect(parseInt(response.headers['content-length'] ?? '0')).toBeGreaterThan(
      0
    );
  });

  describe('PDF options', () => {
    it('should generate PDF with A3 format', async () => {
      const html = '<p>Test document</p>';

      const response = await request(testServer!.host).get('/').query({
        action: 'generatePdf',
        html,
        'options[format]': 'A3'
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');

      // Check PDF signature
      const pdfSignature = response.body.toString('utf8', 0, 4);
      expect(pdfSignature).toBe('%PDF');

      // A3 should produce a different file size than A4
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should generate PDF with landscape orientation', async () => {
      const html = '<p>Landscape document</p>';

      const response = await request(testServer!.host).get('/').query({
        action: 'generatePdf',
        html,
        'options[page_orientation]': 'landscape'
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');

      // Check PDF signature
      const pdfSignature = response.body.toString('utf8', 0, 4);
      expect(pdfSignature).toBe('%PDF');
    });

    it('should generate PDF with both format and orientation options', async () => {
      const html = '<p>Test with options</p>';

      const response = await request(testServer!.host).get('/').query({
        action: 'generatePdf',
        html,
        'options[format]': 'A3',
        'options[page_orientation]': 'landscape'
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');

      // Check PDF signature
      const pdfSignature = response.body.toString('utf8', 0, 4);
      expect(pdfSignature).toBe('%PDF');
    });

    it('should generate PDF with Letter format', async () => {
      const html = '<p>Letter format document</p>';

      const response = await request(testServer!.host).get('/').query({
        action: 'generatePdf',
        html,
        'options[format]': 'Letter'
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('should return 400 for invalid font name', async () => {
      const html = '<p>Test document</p>';

      const response = await request(testServer!.host).get('/').query({
        action: 'generatePdf',
        html,
        'options[defaultFont]': 'Arial' // Invalid font
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data.code).toBe(400);
    });

    it('should generate PDF with valid default font', async () => {
      const html = '<p>Test document</p>';

      const response = await request(testServer!.host).get('/').query({
        action: 'generatePdf',
        html,
        'options[defaultFont]': 'helvetica' // Valid font
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });
  });

  describe('Access Control', () => {
    let aclTestServer: TestServer | null = null;

    afterEach(async () => {
      if (aclTestServer) {
        await stopTestServer(aclTestServer);
        aclTestServer = null;
      }
    });

    it('should allow access when no access control rules defined', async () => {
      aclTestServer = await startTestServer();

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'generatePdf', html: '<p>Test</p>' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('should deny access when role does not have GENERATE_PDF permission', async () => {
      aclTestServer = await startTestServer({
        accessControl: [
          {
            role: 'guest',
            GENERATE_PDF: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'generatePdf', html: '<p>Test</p>' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.code).toBe(403);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should allow access when role has GENERATE_PDF permission', async () => {
      aclTestServer = await startTestServer({
        accessControl: [
          {
            role: 'admin',
            GENERATE_PDF: true
          }
        ],
        defaultRole: 'admin'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'generatePdf', html: '<p>Test</p>' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('should check path-based permissions for GENERATE_PDF action', async () => {
      aclTestServer = await startTestServer({
        accessControl: [
          {
            role: 'guest',
            GENERATE_PDF: true
          },
          {
            role: 'guest',
            path: '/restricted',
            GENERATE_PDF: false
          }
        ],
        defaultRole: 'guest'
      });

      // Should allow PDF generation in root path
      const rootResponse = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'generatePdf', path: '/', html: '<p>Test</p>' });

      expect(rootResponse.status).toBe(200);
      expect(rootResponse.headers['content-type']).toBe('application/pdf');

      // Should deny PDF generation in /restricted path
      const restrictedResponse = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'generatePdf', path: '/restricted', html: '<p>Test</p>' });

      expect(restrictedResponse.status).toBe(403);
      expect(restrictedResponse.body.success).toBe(false);
      expect(restrictedResponse.body.data.messages).toContain('Access denied');
    });

    it('should use wildcard role to deny GENERATE_PDF access to all roles', async () => {
      aclTestServer = await startTestServer({
        accessControl: [
          {
            role: '*',
            GENERATE_PDF: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'generatePdf', html: '<p>Test</p>' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should work with POST method', async () => {
      aclTestServer = await startTestServer({
        accessControl: [
          {
            role: 'guest',
            GENERATE_PDF: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host)
        .post('/')
        .send({
          action: 'generatePdf',
          html: '<p>Test</p>'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });
  });
});
