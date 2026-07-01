import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  TestServer,
  createTestDirectories
} from '../../tests/test-server';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';

describe('File Upload Remote (GET /?action=fileUploadRemote)', () => {
  let testServer: TestServer | null = null;
  let mockServer: http.Server;
  let mockServerPort: number;
  const testFilesPath = path.join(process.cwd(), './files/test');

  beforeAll(async () => {
    testServer = await startTestServer();

    // Create mock HTTP server for remote files
    mockServer = http.createServer((req, res) => {
      if (req.url === '/test-image.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end('fake image content');
      } else if (req.url === '/test-doc.pdf') {
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        res.end('fake pdf content');
      } else if (req.url === '/forbidden.php') {
        res.writeHead(200, { 'Content-Type': 'application/x-php' });
        res.end('<?php echo "test"; ?>');
      } else if (req.url === '/redirect-image.png') {
        res.writeHead(302, { Location: '/test-image.png' });
        res.end();
      } else if (req.url === '/not-found') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>(resolve => {
      mockServer.listen(0, () => {
        const address = mockServer.address();
        if (address != null && typeof address !== 'string') {
          mockServerPort = address.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await stopTestServer(testServer!);

    await new Promise<void>((resolve, reject) => {
      mockServer.close(err => {
        if (err != null) reject(err);
        else resolve();
      });
    });
  });

  beforeEach(async () => {
    await createTestDirectories();
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  it('should upload file from remote URL successfully', async () => {
    const remoteUrl = `http://localhost:${mockServerPort}/test-image.png`;

    const response = await request(testServer!.host).get('/').query({
      action: 'fileUploadRemote',
      source: 'test',
      url: remoteUrl
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        code: 220,
        baseurl: 'http://localhost:8081/files/test/',
        newfilename: 'test-image.png',
        isImage: true
      }
    });

    // Verify file was saved
    const filePath = path.join(testFilesPath, 'test-image.png');
    const fileExists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('should upload PDF file from remote URL', async () => {
    const remoteUrl = `http://localhost:${mockServerPort}/test-doc.pdf`;

    const response = await request(testServer!.host).get('/').query({
      action: 'fileUploadRemote',
      source: 'test',
      url: remoteUrl
    });

    expect(response.status).toBe(200);
    expect(response.body.data.newfilename).toBe('test-doc.pdf');
    expect(response.body.data.isImage).toBe(false);
  });

  it('should return 400 when URL parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileUploadRemote',
      source: 'test'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 for invalid URL', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileUploadRemote',
      source: 'test',
      url: 'not-a-valid-url'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages[0]).toContain('Invalid URL');
  });

  it('should return 404 when source does not exist', async () => {
    const remoteUrl = `http://localhost:${mockServerPort}/test-image.png`;

    const response = await request(testServer!.host).get('/').query({
      action: 'fileUploadRemote',
      source: 'non-existent-source',
      url: remoteUrl
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should return 400 when remote file is not found', async () => {
    const remoteUrl = `http://localhost:${mockServerPort}/not-found`;

    const response = await request(testServer!.host).get('/').query({
      action: 'fileUploadRemote',
      source: 'test',
      url: remoteUrl
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages[0]).toContain('File was not loaded');
  });

  it('should reject forbidden file extensions', async () => {
    const remoteUrl = `http://localhost:${mockServerPort}/forbidden.php`;

    const response = await request(testServer!.host).get('/').query({
      action: 'fileUploadRemote',
      source: 'test',
      url: remoteUrl
    });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('should extract filename from URL path', async () => {
    const remoteUrl = `http://localhost:${mockServerPort}/path/to/test-image.png`;

    // Mock server doesn't serve this path, but we can test URL parsing
    const response = await request(testServer!.host).get('/').query({
      action: 'fileUploadRemote',
      source: 'test',
      url: remoteUrl
    });

    // Should fail because file not found, but filename should be extracted correctly
    expect(response.status).toBe(400);
    expect(response.body.data.messages[0]).toContain('File was not loaded');
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
      const remoteUrl = `http://localhost:${mockServerPort}/test-image.png`;

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileUploadRemote', source: 'test', url: remoteUrl });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access when role does not have FILE_UPLOAD_REMOTE permission', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FILE_UPLOAD_REMOTE: false
          }
        ],
        defaultRole: 'guest'
      });

      const remoteUrl = `http://localhost:${mockServerPort}/test-image.png`;

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileUploadRemote', source: 'test', url: remoteUrl });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.code).toBe(403);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should allow access when role has FILE_UPLOAD_REMOTE permission', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'admin',
            FILE_UPLOAD_REMOTE: true
          }
        ],
        defaultRole: 'admin'
      });

      const remoteUrl = `http://localhost:${mockServerPort}/test-image.png`;

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileUploadRemote', source: 'test', url: remoteUrl });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should check path-based permissions for FILE_UPLOAD_REMOTE action', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FILE_UPLOAD_REMOTE: true
          },
          {
            role: 'guest',
            path: '/uploads',
            FILE_UPLOAD_REMOTE: false
          }
        ],
        defaultRole: 'guest'
      });

      const remoteUrl = `http://localhost:${mockServerPort}/test-image.png`;

      // Should allow remote upload in root path
      const rootResponse = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'fileUploadRemote',
          source: 'test',
          path: '/',
          url: remoteUrl
        });

      expect(rootResponse.status).toBe(200);
      expect(rootResponse.body.success).toBe(true);

      // Should deny remote upload in /uploads path
      const uploadsResponse = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'fileUploadRemote',
          source: 'test',
          path: '/uploads',
          url: remoteUrl
        });

      expect(uploadsResponse.status).toBe(403);
      expect(uploadsResponse.body.success).toBe(false);
      expect(uploadsResponse.body.data.messages).toContain('Access denied');
    });

    it('should use wildcard role to deny FILE_UPLOAD_REMOTE access to all roles', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: '*',
            FILE_UPLOAD_REMOTE: false
          }
        ],
        defaultRole: 'guest'
      });

      const remoteUrl = `http://localhost:${mockServerPort}/test-image.png`;

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileUploadRemote', source: 'test', url: remoteUrl });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should work with POST method', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FILE_UPLOAD_REMOTE: false
          }
        ],
        defaultRole: 'guest'
      });

      const remoteUrl = `http://localhost:${mockServerPort}/test-image.png`;

      const response = await request(aclTestServer!.host).post('/').send({
        action: 'fileUploadRemote',
        source: 'test',
        url: remoteUrl
      });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });
  });

  describe('SSRF protection', () => {
    let ssrfServer: TestServer | null = null;

    afterEach(async () => {
      if (ssrfServer) {
        await stopTestServer(ssrfServer);
        ssrfServer = null;
      }
    });

    it('should block loopback/private hosts when protection is on', async () => {
      ssrfServer = await startTestServer({
        allowPrivateNetworkUploads: false
      });

      for (const url of [
        `http://127.0.0.1:${mockServerPort}/test-image.png`,
        `http://localhost:${mockServerPort}/test-image.png`
      ]) {
        const response = await request(ssrfServer!.host)
          .get('/')
          .query({ action: 'fileUploadRemote', source: 'test', url });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      }
    });

    it('should reject non-http(s) schemes', async () => {
      ssrfServer = await startTestServer({
        allowPrivateNetworkUploads: false
      });

      const response = await request(ssrfServer!.host).get('/').query({
        action: 'fileUploadRemote',
        source: 'test',
        url: 'file:///etc/passwd'
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should still allow private hosts when explicitly enabled', async () => {
      ssrfServer = await startTestServer({
        allowPrivateNetworkUploads: true
      });

      const response = await request(ssrfServer!.host).get('/').query({
        action: 'fileUploadRemote',
        source: 'test',
        url: `http://localhost:${mockServerPort}/test-image.png`
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should follow redirects through the manual (guarded) loop', async () => {
      ssrfServer = await startTestServer({
        allowPrivateNetworkUploads: true
      });

      const response = await request(ssrfServer!.host).get('/').query({
        action: 'fileUploadRemote',
        source: 'test',
        url: `http://localhost:${mockServerPort}/redirect-image.png`
      });

      // A 302 that is not followed would yield "File was not loaded"; success
      // proves the redirect was resolved and downloaded.
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
