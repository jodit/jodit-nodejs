import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  TestServer
} from '../../tests/test-server';

describe('Generate DOCX (GET /?action=generateDocx)', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  beforeEach(async () => {
    await cleanupTestFiles();
  });

  // Helper to make request with binary response
  const requestDocx = (html: string): Promise<request.Response> => {
    return request(testServer!.host)
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
    const response = await request(testServer!.host).get('/').query({
      action: 'generateDocx'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toBeDefined();
  });

  it('should return 400 when html parameter is empty', async () => {
    const response = await request(testServer!.host).get('/').query({
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

  it('should strip <style> tags from HTML before conversion', async () => {
    const html =
      '<style>.jodit { box-sizing: border-box; }</style><p>Hello world!</p>';
    const response = await requestDocx(html);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    // Check it's a valid DOCX file
    const zipSignature = response.body.toString('hex', 0, 4);
    expect(zipSignature).toBe('504b0304');

    // The DOCX content should not contain the style tag text
    const content = response.body.toString('utf8');
    expect(content).not.toContain('box-sizing');
  });

  it('should strip multiple <style> tags', async () => {
    const html =
      '<style>* { margin: 0; }</style><style>.test { color: red; }</style><p>Content</p>';
    const response = await requestDocx(html);

    expect(response.status).toBe(200);
    const content = response.body.toString('utf8');
    expect(content).not.toContain('margin');
    expect(content).not.toContain('color: red');
  });

  it('should generate DOCX from POST request with html in body', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .send({ action: 'generateDocx', html: '<p>POST test</p>' })
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

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    const zipSignature = response.body.toString('hex', 0, 4);
    expect(zipSignature).toBe('504b0304');
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
        .query({ action: 'generateDocx', html: '<p>Test</p>' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    });

    it('should deny access when role does not have GENERATE_DOCX permission', async () => {
      aclTestServer = await startTestServer({
        accessControl: [
          {
            role: 'guest',
            GENERATE_DOCX: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'generateDocx', html: '<p>Test</p>' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.code).toBe(403);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should allow access when role has GENERATE_DOCX permission', async () => {
      aclTestServer = await startTestServer({
        accessControl: [
          {
            role: 'admin',
            GENERATE_DOCX: true
          }
        ],
        defaultRole: 'admin'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'generateDocx', html: '<p>Test</p>' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    });

    it('should check path-based permissions for GENERATE_DOCX action', async () => {
      aclTestServer = await startTestServer({
        accessControl: [
          {
            role: 'guest',
            GENERATE_DOCX: true
          },
          {
            role: 'guest',
            path: '/restricted',
            GENERATE_DOCX: false
          }
        ],
        defaultRole: 'guest'
      });

      // Should allow DOCX generation in root path
      const rootResponse = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'generateDocx', path: '/', html: '<p>Test</p>' });

      expect(rootResponse.status).toBe(200);
      expect(rootResponse.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      // Should deny DOCX generation in /restricted path
      const restrictedResponse = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'generateDocx',
          path: '/restricted',
          html: '<p>Test</p>'
        });

      expect(restrictedResponse.status).toBe(403);
      expect(restrictedResponse.body.success).toBe(false);
      expect(restrictedResponse.body.data.messages).toContain('Access denied');
    });

    it('should use wildcard role to deny GENERATE_DOCX access to all roles', async () => {
      aclTestServer = await startTestServer({
        accessControl: [
          {
            role: '*',
            GENERATE_DOCX: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'generateDocx', html: '<p>Test</p>' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should work with POST method', async () => {
      aclTestServer = await startTestServer({
        accessControl: [
          {
            role: 'guest',
            GENERATE_DOCX: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host).post('/').send({
        action: 'generateDocx',
        html: '<p>Test</p>'
      });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });
  });
});
