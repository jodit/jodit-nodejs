import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  createTestFile,
  TestServer,
  createTestDirectories
} from '../../tests/test-server';

describe('File Download (GET /?action=fileDownload)', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  beforeEach(async () => {
    await createTestDirectories();
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  it('should download file successfully', async () => {
    // Create test file
    const testFileName = 'test-download.txt';
    const testContent = 'content to download';
    await createTestFile(testFileName, testContent);

    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: testFileName
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/octet-stream');
    expect(response.headers['content-disposition']).toContain(
      `attachment; filename="${testFileName}"`
    );
    expect(response.headers['content-transfer-encoding']).toBe('binary');
    expect(response.body.toString()).toBe(testContent);
  });

  it('should download binary file successfully', async () => {
    // Create test binary file
    const testFileName = 'test.bin';
    const testContent = Buffer.from([0x00, 0x01, 0x02, 0xff]);
    await createTestFile(testFileName, testContent.toString('binary'));

    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: testFileName
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/octet-stream');
    expect(Buffer.from(response.body).length).toBeGreaterThan(0);
  });

  it('should return 404 when file does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: 'non-existent-file.txt'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages[0]).toContain(
      'File or directory not exists'
    );
  });

  it('should return 400 when name parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'non-existent-source',
      name: 'test.txt'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should download file from subdirectory', async () => {
    // Create test file in subdirectory
    const testFileName = 'subdir-file.txt';
    const testContent = 'content in subdir';
    await createTestFile(testFileName, testContent, '/subdir');

    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      path: '/subdir',
      name: testFileName
    });

    expect(response.status).toBe(200);
    expect(response.body.toString()).toBe(testContent);
  });

  it('should reject path traversal attempts', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: '../../../etc/passwd'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when trying to download directory', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: 'subdir'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('It is not a file!');
  });

  it('should set correct content-length header', async () => {
    const testFileName = 'sized-file.txt';
    const testContent = 'exact content';
    await createTestFile(testFileName, testContent);

    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: testFileName
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-length']).toBe(
      testContent.length.toString()
    );
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
      await createTestFile('acl-test.txt', 'test content');

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileDownload', source: 'test', name: 'acl-test.txt' });

      expect(response.status).toBe(200);
    });

    it('should deny access when role does not have FILE_DOWNLOAD permission', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: './files/test',
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FILE_DOWNLOAD: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestFile('test.txt', 'content');

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileDownload', source: 'test', name: 'test.txt' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.code).toBe(403);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should allow access when role has FILE_DOWNLOAD permission', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: './files/test',
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'admin',
            FILE_DOWNLOAD: true
          }
        ],
        defaultRole: 'admin'
      });

      await createTestFile('test.txt', 'content');

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileDownload', source: 'test', name: 'test.txt' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/octet-stream');
    });

    it('should check path-based permissions for FILE_DOWNLOAD action', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: './files/test',
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FILE_DOWNLOAD: true
          },
          {
            role: 'guest',
            path: '/subdir',
            FILE_DOWNLOAD: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestFile('public.txt', 'public content');
      await createTestFile('protected.txt', 'protected content', '/subdir');

      // Should allow download in root path
      const rootResponse = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileDownload', source: 'test', path: '/', name: 'public.txt' });

      expect(rootResponse.status).toBe(200);
      expect(rootResponse.headers['content-type']).toBe('application/octet-stream');

      // Should deny download in /subdir path
      const subdirResponse = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileDownload', source: 'test', path: '/subdir', name: 'protected.txt' });

      expect(subdirResponse.status).toBe(403);
      expect(subdirResponse.body.success).toBe(false);
      expect(subdirResponse.body.data.messages).toContain('Access denied');
    });

    it('should use wildcard role to deny FILE_DOWNLOAD access to all roles', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: './files/test',
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: '*',
            FILE_DOWNLOAD: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestFile('test.txt', 'content');

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileDownload', source: 'test', name: 'test.txt' });

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
            root: './files/test',
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FILE_DOWNLOAD: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestFile('test.txt', 'content');

      const response = await request(aclTestServer!.host)
        .post('/')
        .send({
          action: 'fileDownload',
          source: 'test',
          name: 'test.txt'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });
  });
});
